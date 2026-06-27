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

export type DrArchiveStreamRegistryEntry = {
  streamId: number;
  entryName: string;
  createdAt: string;
  producerCompleted: boolean;
  readableEnded: boolean;
  readableClosed: boolean;
  destroyed: boolean;
  error?: string;
  completedAt?: string;
};

export type DrArchiveStreamRegistry = {
  registerArchiveStream: (stream: Readable, entryName: string) => number;
  markProducerCompleted: (stream: Readable) => void;
  markProducerError: (stream: Readable, error: Error | string) => void;
  logStreamRegistrySummary: () => void;
  assertAllProducersCompleted: () => void;
  dispose: () => void;
  getSummary: () => {
    total: number;
    completed: number;
    incomplete: number;
    lastIncompleteEntry: DrArchiveStreamRegistryEntry | null;
  };
};

let drArchiveStreamIdCounter = 0;

const readStreamRegistryFlags = (
  stream: Readable
): Pick<
  DrArchiveStreamRegistryEntry,
  "readableEnded" | "readableClosed" | "destroyed"
> => ({
  readableEnded: Boolean(stream.readableEnded),
  readableClosed: Boolean((stream as { closed?: boolean }).closed),
  destroyed: Boolean(stream.destroyed),
});

export const createDrArchiveStreamRegistry = (): DrArchiveStreamRegistry => {
  const entries = new Map<number, DrArchiveStreamRegistryEntry>();
  const streamToId = new WeakMap<Readable, number>();

  const syncStreamFlags = (streamId: number, stream: Readable): void => {
    const entry = entries.get(streamId);
    if (!entry) return;
    Object.assign(entry, readStreamRegistryFlags(stream));
  };

  const registerArchiveStream = (stream: Readable, entryName: string): number => {
    const streamId = ++drArchiveStreamIdCounter;
    const entry: DrArchiveStreamRegistryEntry = {
      streamId,
      entryName,
      createdAt: new Date().toISOString(),
      producerCompleted: false,
      ...readStreamRegistryFlags(stream),
    };
    entries.set(streamId, entry);
    streamToId.set(stream, streamId);

    const refresh = (): void => {
      syncStreamFlags(streamId, stream);
    };

    stream.on("end", refresh);
    stream.on("close", refresh);
    stream.on("error", (error) => {
      syncStreamFlags(streamId, stream);
      markProducerError(stream, error);
    });

    return streamId;
  };

  const resolveStreamId = (stream: Readable): number | undefined => streamToId.get(stream);

  const markProducerCompleted = (stream: Readable): void => {
    const streamId = resolveStreamId(stream);
    if (streamId === undefined) return;
    const entry = entries.get(streamId);
    if (!entry) return;
    entry.producerCompleted = true;
    entry.completedAt = new Date().toISOString();
    syncStreamFlags(streamId, stream);
  };

  const markProducerError = (stream: Readable, error: Error | string): void => {
    const streamId = resolveStreamId(stream);
    if (streamId === undefined) return;
    const entry = entries.get(streamId);
    if (!entry) return;
    entry.error = error instanceof Error ? error.message : error;
    syncStreamFlags(streamId, stream);
  };

  const getIncompleteEntries = (): DrArchiveStreamRegistryEntry[] =>
    [...entries.values()].filter((entry) => !entry.producerCompleted);

  const getSummary = () => {
    const all = [...entries.values()];
    const incomplete = getIncompleteEntries();
    return {
      total: all.length,
      completed: all.length - incomplete.length,
      incomplete: incomplete.length,
      lastIncompleteEntry: incomplete[incomplete.length - 1] ?? null,
    };
  };

  const logStreamRegistrySummary = (): void => {
    const summary = getSummary();
    console.info("[DR] STREAM_REGISTRY_SUMMARY", summary);
    for (const entry of getIncompleteEntries()) {
      console.error("[DR] STREAM_REGISTRY_ENTRY", entry);
    }
  };

  const assertAllProducersCompleted = (): void => {
    const incomplete = getIncompleteEntries();
    if (incomplete.length === 0) return;

    logStreamRegistrySummary();
    const details = incomplete
      .map(
        (entry) =>
          `entry=${entry.entryName};producerCompleted=${entry.producerCompleted};readableEnded=${entry.readableEnded};readableClosed=${entry.readableClosed};destroyed=${entry.destroyed};error=${entry.error ?? "none"}`
      )
      .join("|");
    throw new Error(`STREAM_NOT_COMPLETED_BEFORE_FINALIZE:${details}`);
  };

  const dispose = (): void => {
    entries.clear();
  };

  return {
    registerArchiveStream,
    markProducerCompleted,
    markProducerError,
    logStreamRegistrySummary,
    assertAllProducersCompleted,
    dispose,
    getSummary,
  };
};

const waitForArchiveProducerWritableFinish = async (stream: PassThrough): Promise<void> => {
  if (stream.writableFinished) return;
  await finished(stream, { readable: false });
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
    .then(async (): Promise<StorageManifestEntry> => {
      await waitForArchiveProducerWritableFinish(archiveStream);
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
      throw error instanceof Error ? error : new Error(String(error));
    });

  return { stream: archiveStream, completed };
};
