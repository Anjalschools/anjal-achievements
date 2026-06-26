import { createHash } from "crypto";
import { finished } from "stream/promises";
import { Readable, Transform, PassThrough } from "stream";
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
  transformOrDestination: NodeJS.WritableStream | Transform,
  timeoutMsOrDestination: number | NodeJS.WritableStream,
  operationOrTimeoutMs?: string | number,
  metaOrOperation?: { objectKey?: string; provider?: string; objectId?: string; streamName?: string } | string,
  meta?: { objectKey?: string; provider?: string; objectId?: string; streamName?: string }
): Promise<void> => {
  const hasTransform =
    typeof (transformOrDestination as Transform)._transform === "function" &&
    timeoutMsOrDestination !== undefined &&
    typeof timeoutMsOrDestination !== "number";

  const destination = hasTransform
    ? (timeoutMsOrDestination as NodeJS.WritableStream)
    : transformOrDestination;
  const timeoutMs = hasTransform
    ? (operationOrTimeoutMs as number)
    : (timeoutMsOrDestination as number);
  const operation = hasTransform
    ? (metaOrOperation as string)
    : (operationOrTimeoutMs as string);
  const pipelineMeta = hasTransform
    ? meta
    : (metaOrOperation as { objectKey?: string; provider?: string; objectId?: string; streamName?: string });

  const pipelineContext = {
    provider: pipelineMeta?.provider ?? "unknown",
    archivePath: pipelineMeta?.objectKey ?? "unknown",
    objectId: pipelineMeta?.objectId,
    streamName: pipelineMeta?.streamName ?? operation,
    storageKey: pipelineMeta?.objectKey,
  };

  source.on("error", (error) => {
    logDrPipelineStreamError({ ...pipelineContext, streamName: `${operation}:source` }, error);
  });
  destination.on("error", (error) => {
    logDrPipelineStreamError({ ...pipelineContext, streamName: `${operation}:destination` }, error);
  });
  if (hasTransform) {
    transformOrDestination.on("error", (error) => {
      logDrPipelineStreamError({ ...pipelineContext, streamName: `${operation}:transform` }, error);
    });
  }

  try {
    if (hasTransform) {
      await withDrTimeout(
        pipeline(source, transformOrDestination as Transform, destination, { end: true }),
        timeoutMs,
        operation,
        pipelineMeta
      );
      return;
    }

    await withDrTimeout(pipeline(source, destination), timeoutMs, operation, pipelineMeta);
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

  const archiveStream = new PassThrough();
  const hashTransform = new Transform({
    transform(chunk, _encoding, callback) {
      hash.update(chunk);
      byteLength += chunk.length;
      callback(null, chunk);
    },
  });

  monitorDrStream(archiveStream, { objectKey, stage: "hashing-transform" });
  attachDrObjectStreamErrorLogging(archiveStream, {
    ...streamContext,
    streamName: "hashing-transform",
  });
  attachDrObjectStreamErrorLogging(hashTransform, {
    ...streamContext,
    streamName: "hashing-pipeline-transform",
  });

  const completed = pipelineWithTimeout(
    monitoredSource,
    hashTransform,
    archiveStream,
    DR_STREAM_COMPLETED_TIMEOUT_MS,
    "hashingPipeline",
    {
      objectKey,
      provider: entry.provider,
      objectId: entry.id,
      streamName: "hashingPipeline",
    }
  )
    .then((): StorageManifestEntry => {
      let errorMessage = entry.errorMessage;
      if (entry.fileSize && entry.fileSize > 0 && byteLength !== entry.fileSize) {
        errorMessage = `SIZE_MISMATCH:expected=${entry.fileSize},actual=${byteLength}`;
      }
      logDrObjectDiag("Download finished", {
        objectKey,
        byteLength,
        elapsedMs: undefined,
      });
      return {
        ...entry,
        fileSize: byteLength,
        checksum: hash.digest("hex"),
        status: "exported",
        errorMessage,
      };
    })
    .catch((error) => {
      logDrPipelineStreamError(
        { ...streamContext, streamName: "hashingPipeline" },
        error
      );
      destroyDrStream(monitoredSource, error instanceof Error ? error : undefined);
      destroyDrStream(archiveStream, error instanceof Error ? error : undefined);
      throw error instanceof Error ? error : new Error(String(error));
    });

  return { stream: archiveStream, completed };
};
