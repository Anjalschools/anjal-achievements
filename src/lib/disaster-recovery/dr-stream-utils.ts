import { createHash } from "crypto";
import { finished } from "stream/promises";
import { Readable, Transform, PassThrough } from "stream";
import { pipeline } from "stream/promises";
import {
  DR_STREAM_COMPLETED_TIMEOUT_MS,
  DrOperationTimeoutError,
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

let hashingPipelineIdCounter = 0;

type HashingPipelineLifecycleEvent = {
  stage: string;
  event: string;
  at: string;
  [key: string]: unknown;
};

type HashingPipelineStateFlags = {
  pipelineCreated: boolean;
  pipelinePromiseCreated: boolean;
  pipelineWaiting: boolean;
  pipelineResolved: boolean;
  pipelineRejected: boolean;
  finishedWaitBegin: boolean;
  finishedWaitEnd: boolean;
  finishedWaitError: boolean;
};

type HashingPipelineForensicsContext = {
  pipelineId: number;
  objectKey: string;
  startedAt: number;
  log: (label: string, extra?: Record<string, unknown>) => void;
  recordLifecycle: (stage: string, event: string, extra?: Record<string, unknown>) => void;
  attachSourceStream: (stream: Readable) => void;
  attachHashTransform: (stream: Transform) => void;
  attachArchiveStream: (stream: PassThrough) => void;
  markPipelineCreated: () => void;
  markPipelinePromiseCreated: () => void;
  markPipelineWaiting: () => void;
  markPipelineResolved: () => void;
  markPipelineRejected: () => void;
  markFinishedWaitBegin: () => void;
  markFinishedWaitEnd: () => void;
  markFinishedWaitError: () => void;
  startHeartbeat: (
    source: Readable,
    hashTransform: Transform,
    archiveStream: PassThrough
  ) => void;
  stopHeartbeat: () => void;
  dumpTimeout: (extra?: { durationMs?: number; error?: unknown }) => void;
  getSourceSnapshot: (stream: Readable) => Record<string, unknown>;
  getTransformSnapshot: (stream: Transform) => Record<string, unknown>;
  getArchiveSnapshot: (stream: PassThrough) => Record<string, unknown>;
};

type ReadableLike = {
  readable?: boolean;
  readableEnded?: boolean;
  readableFlowing?: boolean | null;
  bytesRead?: number;
  closed?: boolean;
  destroyed?: boolean;
  writableHighWaterMark?: number;
};

type WritableLike = {
  writable?: boolean;
  writableFinished?: boolean;
  writableEnded?: boolean;
};

const asReadableLike = (stream: unknown): ReadableLike => stream as unknown as ReadableLike;

const asWritableLike = (stream: unknown): WritableLike => stream as unknown as WritableLike;

const readReadableStreamFlags = (
  stream: Readable
): Record<string, unknown> => {
  const readable = asReadableLike(stream);
  return {
    readable: stream.readable,
    destroyed: Boolean(stream.destroyed),
    closed: Boolean(readable.closed),
    readableEnded: Boolean(stream.readableEnded),
    readableFlowing: stream.readableFlowing,
    bytesRead: readable.bytesRead ?? null,
  };
};

const readWritableStreamFlags = (
  stream: NodeJS.ReadWriteStream
): Record<string, unknown> => {
  const readable = asReadableLike(stream);
  const writable = asWritableLike(stream);
  return {
    writable: writable.writable,
    readable: readable.readable,
    destroyed: Boolean(readable.destroyed),
    writableFinished: Boolean(writable.writableFinished),
    readableEnded: Boolean(readable.readableEnded),
    writableEnded: Boolean(writable.writableEnded),
  };
};

const createHashingPipelineForensics = (
  entry: StorageManifestEntry,
  sourceStream: Readable
): HashingPipelineForensicsContext => {
  const pipelineId = ++hashingPipelineIdCounter;
  const objectKey = entry.archivePath;
  const startedAt = Date.now();
  let lastLifecycleEvent: HashingPipelineLifecycleEvent | null = null;
  let lastChunkSize = 0;
  let lastChunkTimestamp: string | null = null;
  let totalBytes = 0;
  let bytesWritten = 0;
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  let sourceRef: Readable | null = null;
  let transformRef: Transform | null = null;
  let archiveRef: PassThrough | null = null;
  const pipelineState: HashingPipelineStateFlags = {
    pipelineCreated: false,
    pipelinePromiseCreated: false,
    pipelineWaiting: false,
    pipelineResolved: false,
    pipelineRejected: false,
    finishedWaitBegin: false,
    finishedWaitEnd: false,
    finishedWaitError: false,
  };

  const log = (label: string, extra: Record<string, unknown> = {}): void => {
    console.info(`[DR] HASHING_PIPELINE_FORENSICS ${label}`, {
      pipelineId,
      objectKey,
      objectId: entry.id,
      timestamp: new Date().toISOString(),
      ...extra,
    });
  };

  const recordLifecycle = (
    stage: string,
    event: string,
    extra: Record<string, unknown> = {}
  ): void => {
    lastLifecycleEvent = {
      stage,
      event,
      at: new Date().toISOString(),
      pipelineId,
      ...extra,
    };
  };

  const attachPassiveStreamEvents = (
    stream: NodeJS.EventEmitter,
    stage: string,
    events: readonly string[],
    snapshot: () => Record<string, unknown>
  ): void => {
    stream.setMaxListeners(Math.max(stream.getMaxListeners(), events.length + 20));
    events.forEach((event) => {
      stream.on(event, (...args: unknown[]) => {
        recordLifecycle(stage, event, snapshot());
        const payload: Record<string, unknown> = {
          pipelineId,
          event,
          timestamp: new Date().toISOString(),
          ...snapshot(),
        };
        if (event === "error") {
          payload.message =
            args[0] instanceof Error ? args[0].message : String(args[0]);
        }
        if (event === "pipe" || event === "unpipe") {
          payload.peerType = (args[0] as { constructor?: { name?: string } })?.constructor?.name;
        }
        console.info(`[DR] HASHING_PIPELINE_FORENSICS ${stage}_EVENT`, payload);
      });
    });
  };

  const attachSourceStream = (stream: Readable): void => {
    sourceRef = stream;
    log("SOURCE_STREAM_CREATED", readReadableStreamFlags(stream));
    attachPassiveStreamEvents(
      stream,
      "SOURCE",
      ["data", "resume", "pause", "end", "close", "finish", "error", "destroy"] as const,
      () => readReadableStreamFlags(stream)
    );
    stream.on("data", (chunk: Buffer | string) => {
      const size = Buffer.isBuffer(chunk) ? chunk.byteLength : Buffer.byteLength(chunk);
      lastChunkSize = size;
      lastChunkTimestamp = new Date().toISOString();
      totalBytes += size;
    });
    stream.on("aborted", () => {
      recordLifecycle("SOURCE", "aborted", readReadableStreamFlags(stream));
      console.info("[DR] HASHING_PIPELINE_FORENSICS SOURCE_EVENT", {
        pipelineId,
        event: "aborted",
        timestamp: new Date().toISOString(),
        ...readReadableStreamFlags(stream),
      });
    });
  };

  const attachHashTransform = (stream: Transform): void => {
    transformRef = stream;
    log("HASH_TRANSFORM_CREATED", readWritableStreamFlags(stream));
    attachPassiveStreamEvents(
      stream,
      "HASH",
      ["pipe", "unpipe", "drain", "finish", "end", "close", "error"] as const,
      () => readWritableStreamFlags(stream)
    );
    stream.on("data", (chunk: Buffer | string) => {
      const size = Buffer.isBuffer(chunk) ? chunk.byteLength : Buffer.byteLength(chunk);
      bytesWritten += size;
    });
  };

  const attachArchiveStream = (stream: PassThrough): void => {
    archiveRef = stream;
    log("ARCHIVE_STREAM_CREATED", {
      ...readWritableStreamFlags(stream),
      readableHighWaterMark: stream.readableHighWaterMark,
      writableHighWaterMark: stream.writableHighWaterMark,
    });
    attachPassiveStreamEvents(
      stream,
      "ARCHIVE",
      ["pipe", "unpipe", "drain", "finish", "end", "close", "error"] as const,
      () => ({
        ...readWritableStreamFlags(stream),
        destroyed: stream.destroyed,
        writableFinished: stream.writableFinished,
        readableEnded: stream.readableEnded,
      })
    );
  };

  const getSourceSnapshot = (stream: Readable): Record<string, unknown> =>
    readReadableStreamFlags(stream);

  const getTransformSnapshot = (stream: Transform): Record<string, unknown> =>
    readWritableStreamFlags(stream);

  const getArchiveSnapshot = (stream: PassThrough): Record<string, unknown> => ({
    ...readWritableStreamFlags(stream),
    destroyed: stream.destroyed,
    writableFinished: stream.writableFinished,
    readableEnded: stream.readableEnded,
  });

  const startHeartbeat = (
    source: Readable,
    hashTransform: Transform,
    archiveStream: PassThrough
  ): void => {
    heartbeatTimer = setInterval(() => {
      log("PIPELINE_IN_PROGRESS", {
        elapsedMs: Date.now() - startedAt,
        bytesRead: asReadableLike(source).bytesRead ?? null,
        bytesWritten,
        totalBytes,
        sourceDestroyed: source.destroyed,
        sourceEnded: source.readableEnded,
        transformFinished: hashTransform.writableFinished,
        transformEnded: hashTransform.readableEnded,
        archiveFinished: archiveStream.writableFinished,
        archiveEnded: archiveStream.readableEnded,
        lastLifecycleEvent,
        lastChunkSize,
        lastChunkTimestamp,
      });
    }, 5_000);
  };

  const stopHeartbeat = (): void => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = undefined;
    }
  };

  const dumpTimeout = (extra: { durationMs?: number; error?: unknown } = {}): void => {
    stopHeartbeat();
    const error = extra.error;
    console.error("[DR] HASHING_PIPELINE_FORENSICS PIPELINE_TIMEOUT_DUMP", {
      pipelineId,
      objectKey,
      objectId: entry.id,
      provider: entry.provider,
      storageKey: entry.storageKey,
      durationMs: extra.durationMs ?? Date.now() - startedAt,
      error: error instanceof Error ? error.message : error ? String(error) : undefined,
      stack: error instanceof Error ? error.stack : undefined,
      source: sourceRef ? getSourceSnapshot(sourceRef) : null,
      hashTransform: transformRef ? getTransformSnapshot(transformRef) : null,
      archiveStream: archiveRef ? getArchiveSnapshot(archiveRef) : null,
      lastLifecycleEvent,
      lastChunkSize,
      lastChunkTimestamp,
      totalBytes,
      bytesWritten,
      pipelineState: { ...pipelineState },
    });
  };

  log("PIPELINE_CREATE", {
    objectId: entry.id,
    storageKey: entry.storageKey,
    provider: entry.provider,
    entryName: entry.archivePath,
    streamType: sourceStream.constructor?.name ?? typeof sourceStream,
    readableHighWaterMark: sourceStream.readableHighWaterMark,
    writableHighWaterMark: asReadableLike(sourceStream).writableHighWaterMark ?? null,
  });
  pipelineState.pipelineCreated = true;

  return {
    pipelineId,
    objectKey,
    startedAt,
    log,
    recordLifecycle,
    attachSourceStream,
    attachHashTransform,
    attachArchiveStream,
    markPipelineCreated: () => {
      pipelineState.pipelineCreated = true;
    },
    markPipelinePromiseCreated: () => {
      pipelineState.pipelinePromiseCreated = true;
    },
    markPipelineWaiting: () => {
      pipelineState.pipelineWaiting = true;
    },
    markPipelineResolved: () => {
      pipelineState.pipelineResolved = true;
      pipelineState.pipelineWaiting = false;
    },
    markPipelineRejected: () => {
      pipelineState.pipelineRejected = true;
      pipelineState.pipelineWaiting = false;
    },
    markFinishedWaitBegin: () => {
      pipelineState.finishedWaitBegin = true;
    },
    markFinishedWaitEnd: () => {
      pipelineState.finishedWaitEnd = true;
    },
    markFinishedWaitError: () => {
      pipelineState.finishedWaitError = true;
    },
    startHeartbeat,
    stopHeartbeat,
    dumpTimeout,
    getSourceSnapshot,
    getTransformSnapshot,
    getArchiveSnapshot,
  };
};

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
  meta?: { objectKey?: string; provider?: string; objectId?: string; streamName?: string },
  hashingForensics?: HashingPipelineForensicsContext
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
    const runPipeline = async (): Promise<void> => {
      hashingForensics?.log("PIPELINE_BEGIN");
      hashingForensics?.markPipelineCreated();
      if (hasTransform) {
        const pipelinePromise = pipeline(source, transformOrDestination as Transform, destination, {
          end: true,
        });
        hashingForensics?.log("PIPELINE_PROMISE_CREATED");
        hashingForensics?.markPipelinePromiseCreated();
        hashingForensics?.log("PIPELINE_WAIT_BEGIN");
        hashingForensics?.markPipelineWaiting();
        hashingForensics?.startHeartbeat(
          source,
          transformOrDestination as Transform,
          destination as PassThrough
        );
        await pipelinePromise;
        return;
      }

      const pipelinePromise = pipeline(source, destination);
      hashingForensics?.log("PIPELINE_PROMISE_CREATED");
      hashingForensics?.markPipelinePromiseCreated();
      hashingForensics?.log("PIPELINE_WAIT_BEGIN");
      hashingForensics?.markPipelineWaiting();
      await pipelinePromise;
    };

    const pipelineStartedAt = Date.now();
    await withDrTimeout(runPipeline(), timeoutMs, operation, pipelineMeta);
    hashingForensics?.stopHeartbeat();
    hashingForensics?.markPipelineResolved();
    hashingForensics?.log("PIPELINE_WAIT_END", {
      durationMs: Date.now() - pipelineStartedAt,
    });
  } catch (error) {
    hashingForensics?.stopHeartbeat();
    if (
      hashingForensics &&
      error instanceof DrOperationTimeoutError &&
      error.operation === operation
    ) {
      hashingForensics.dumpTimeout({
        durationMs: Date.now() - hashingForensics.startedAt,
        error,
      });
      hashingForensics.markPipelineRejected();
    } else if (hashingForensics) {
      hashingForensics.markPipelineRejected();
      hashingForensics.log("PIPELINE_WAIT_ERROR", {
        durationMs: Date.now() - hashingForensics.startedAt,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
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
  readableClosed: Boolean(asReadableLike(stream).closed),
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

const waitForArchiveProducerWritableFinish = async (
  stream: PassThrough,
  hashingForensics?: HashingPipelineForensicsContext
): Promise<void> => {
  if (stream.writableFinished) return;
  hashingForensics?.log("FINISHED_WAIT_BEGIN", {
    stream: "archive",
    ...hashingForensics.getArchiveSnapshot(stream),
  });
  hashingForensics?.markFinishedWaitBegin();
  try {
    await finished(stream, { readable: false });
    hashingForensics?.markFinishedWaitEnd();
    hashingForensics?.log("FINISHED_WAIT_END", {
      stream: "archive",
      ...hashingForensics.getArchiveSnapshot(stream),
    });
  } catch (error) {
    hashingForensics?.markFinishedWaitError();
    hashingForensics?.log("FINISHED_WAIT_ERROR", {
      stream: "archive",
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      ...hashingForensics.getArchiveSnapshot(stream),
    });
    throw error;
  }
};

export const createHashingObjectStream = (
  entry: StorageManifestEntry,
  sourceStream: Readable
): HashingObjectStream => {
  const objectKey = entry.archivePath;
  const streamContext = buildDrObjectStreamContext({ entry });
  const hashingForensics = createHashingPipelineForensics(entry, sourceStream);

  attachDrObjectStreamErrorLogging(sourceStream, {
    ...streamContext,
    streamName: "object-source-raw",
  });

  const monitoredSource = monitorDrStream(sourceStream, {
    objectKey,
    stage: "object-source",
  });
  hashingForensics.attachSourceStream(monitoredSource);

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

  hashingForensics.attachHashTransform(hashTransform);
  hashingForensics.attachArchiveStream(archiveStream);

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
    },
    hashingForensics
  )
    .then(async (): Promise<StorageManifestEntry> => {
      await waitForArchiveProducerWritableFinish(archiveStream, hashingForensics);
      let errorMessage = entry.errorMessage;
      if (entry.fileSize && entry.fileSize > 0 && byteLength !== entry.fileSize) {
        errorMessage = `SIZE_MISMATCH:expected=${entry.fileSize},actual=${byteLength}`;
      }
      logDrObjectDiag("Download finished", {
        objectKey,
        byteLength,
        elapsedMs: undefined,
        pipelineId: hashingForensics.pipelineId,
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
      hashingForensics.stopHeartbeat();
      if (
        !(error instanceof DrOperationTimeoutError && error.operation === "hashingPipeline")
      ) {
        hashingForensics.log("PIPELINE_WAIT_ERROR", {
          durationMs: Date.now() - hashingForensics.startedAt,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          source: hashingForensics.getSourceSnapshot(monitoredSource),
          hashTransform: hashingForensics.getTransformSnapshot(hashTransform),
          archiveStream: hashingForensics.getArchiveSnapshot(archiveStream),
        });
      }
      logDrPipelineStreamError(
        { ...streamContext, streamName: "hashingPipeline" },
        error
      );
      destroyDrStream(monitoredSource, error instanceof Error ? error : undefined);
      throw error instanceof Error ? error : new Error(String(error));
    });

  return { stream: archiveStream, completed };
};
