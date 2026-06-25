import { createHash } from "crypto";
import { finished } from "stream/promises";
import { Readable, Transform } from "stream";
import { pipeline } from "stream/promises";
import {
  DR_STREAM_COMPLETED_TIMEOUT_MS,
  withDrTimeout,
} from "@/lib/disaster-recovery/dr-async-timeout";
import { destroyDrStream, logDrObjectDiag, monitorDrStream } from "@/lib/disaster-recovery/dr-stream-lifecycle";
import {
  attachDrObjectStreamErrorLogging,
  buildDrObjectStreamContext,
  logDrPipelineStreamError,
} from "@/lib/disaster-recovery/dr-object-stream-diagnostics";
import type { StorageManifestEntry } from "@/lib/disaster-recovery/storage-manifest-types";

export const isNodeReadableStream = (source: Buffer | Readable): source is Readable =>
  !Buffer.isBuffer(source) && typeof source.pipe === "function";

export const webBodyToNodeStream = (body: ReadableStream<Uint8Array>): Readable =>
  Readable.fromWeb(body as import("stream/web").ReadableStream);

export const finishedWithTimeout = async (
  stream: Readable,
  timeoutMs: number,
  operation: string,
  meta?: { objectKey?: string }
): Promise<void> => {
  await withDrTimeout(finished(stream), timeoutMs, operation, meta);
};

export const pipelineWithTimeout = async (
  source: Readable,
  destination: NodeJS.WritableStream,
  timeoutMs: number,
  operation: string,
  meta?: { objectKey?: string; provider?: string; objectId?: string; streamName?: string }
): Promise<void> => {
  const pipelineContext = {
    provider: meta?.provider ?? "unknown",
    archivePath: meta?.objectKey ?? "unknown",
    objectId: meta?.objectId,
    streamName: meta?.streamName ?? operation,
    storageKey: meta?.objectKey,
  };

  source.on("error", (error) => {
    logDrPipelineStreamError({ ...pipelineContext, streamName: `${operation}:source` }, error);
  });
  destination.on("error", (error) => {
    logDrPipelineStreamError({ ...pipelineContext, streamName: `${operation}:destination` }, error);
  });

  try {
    await withDrTimeout(pipeline(source, destination), timeoutMs, operation, meta);
  } catch (error) {
    logDrPipelineStreamError({ ...pipelineContext, streamName: operation }, error);
    throw error;
  }
};

export type HashingObjectStream = {
  stream: Readable;
  completed: Promise<StorageManifestEntry>;
};

export const createHashingObjectStream = (
  entry: StorageManifestEntry,
  sourceStream: Readable
): HashingObjectStream => {
  const objectKey = entry.archivePath;
  const streamContext = buildDrObjectStreamContext({ entry });

  attachDrObjectStreamErrorLogging(sourceStream, {
    ...streamContext,
    streamName: "object-source-raw",
  });

  const monitoredSource = monitorDrStream(sourceStream, {
    objectKey,
    stage: "object-source",
  });

  const hash = createHash("sha256");
  let byteLength = 0;

  let resolveCompleted!: (entry: StorageManifestEntry) => void;
  let rejectCompleted!: (error: Error) => void;
  const completed = new Promise<StorageManifestEntry>((resolve, reject) => {
    resolveCompleted = resolve;
    rejectCompleted = reject;
  });

  let settled = false;
  const settleCompleted = (finalizedEntry: StorageManifestEntry): void => {
    if (settled) return;
    settled = true;
    resolveCompleted(finalizedEntry);
  };
  const rejectWith = (error: Error): void => {
    if (settled) return;
    settled = true;
    rejectCompleted(error);
  };

  const transform = new Transform({
    transform(chunk, _encoding, callback) {
      hash.update(chunk);
      byteLength += chunk.length;
      callback(null, chunk);
    },
    flush(callback) {
      try {
        let errorMessage = entry.errorMessage;
        if (entry.fileSize && entry.fileSize > 0 && byteLength !== entry.fileSize) {
          errorMessage = `SIZE_MISMATCH:expected=${entry.fileSize},actual=${byteLength}`;
        }
        logDrObjectDiag("Download finished", {
          objectKey,
          byteLength,
          elapsedMs: undefined,
        });
        settleCompleted({
          ...entry,
          fileSize: byteLength,
          checksum: hash.digest("hex"),
          status: "exported",
          errorMessage,
        });
        callback();
      } catch (error) {
        callback(error as Error);
      }
    },
  });

  monitorDrStream(transform, { objectKey, stage: "hashing-transform" });
  attachDrObjectStreamErrorLogging(transform, {
    ...streamContext,
    streamName: "hashing-transform",
  });

  transform.on("error", (error) => {
    logDrPipelineStreamError(
      { ...streamContext, streamName: "hashing-transform" },
      error
    );
    rejectWith(error);
  });

  pipelineWithTimeout(
    monitoredSource,
    transform,
    DR_STREAM_COMPLETED_TIMEOUT_MS,
    "hashingPipeline",
    {
      objectKey,
      provider: entry.provider,
      objectId: entry.id,
      streamName: "hashingPipeline",
    }
  ).catch((error) => {
    logDrPipelineStreamError(
      { ...streamContext, streamName: "hashingPipeline" },
      error
    );
    destroyDrStream(monitoredSource, error instanceof Error ? error : undefined);
    destroyDrStream(transform, error instanceof Error ? error : undefined);
    rejectWith(error instanceof Error ? error : new Error(String(error)));
  });

  return { stream: transform, completed };
};
