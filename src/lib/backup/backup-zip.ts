import { PassThrough, Readable } from "stream";
import { EventEmitter } from "events";
import { readFileSync } from "fs";
import { join } from "path";
import unzipper from "unzipper";
import { hashContent, serializeManifest, type BackupManifest } from "@/lib/backup/backup-manifest";
import { resolveCollectionFileName } from "@/lib/backup/backup-constants";
import {
  DR_ARCHIVE_FINALIZE_TIMEOUT_MS,
  DrOperationTimeoutError,
  withDrTimeout,
} from "@/lib/disaster-recovery/dr-async-timeout";
import { logDrObjectDiag } from "@/lib/disaster-recovery/dr-stream-lifecycle";
import { isNodeReadableStream } from "@/lib/disaster-recovery/dr-stream-utils";

const loadZipArchive = async () => {
  const { ZipArchive } = await import(/* webpackIgnore: true */ "archiver");
  return ZipArchive;
};

export type BackupPackageEntry = {
  collectionKey: string;
  fileName: string;
  content: Buffer;
  recordCount: number;
  checksum: string;
};

const streamToBuffer = async (stream: Readable): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

export type BackupPackageExtraFile = {
  path: string;
  content: Buffer;
};

export type ZipPipelineDiagnostics = {
  phase: string;
  at: string;
  archivePointer: number;
  queueLength: number;
  queueIdle: boolean;
  entriesQueued: number;
  entriesProcessed: number;
  pending: number;
  archiveFinalized: boolean;
  archiveFinalizing: boolean;
  archiveAborted: boolean;
  outputDestroyed: boolean;
  outputWritableNeedDrain: boolean;
  outputWritableLength: number;
  outputReadableLength: number;
  outputWritableEnded: boolean;
  outputWritableFinished: boolean;
  outputReadableEnded: boolean;
  outputClosed: boolean;
  archivePaused: boolean;
};

type ArchiverWithInternals = EventEmitter & {
  pointer: () => number;
  append: (source: Buffer | Readable, options: { name: string }) => void;
  pipe: (destination: PassThrough) => void;
  finalize: () => Promise<void>;
  resume?: () => void;
  isPaused?: () => boolean;
  readableEnded?: boolean;
  writableEnded?: boolean;
  writableFinished?: boolean;
  destroyed?: boolean;
  _queue?: {
    idle: () => boolean;
    length: () => number;
    drain: (callback: () => void) => void;
  };
  _statQueue?: {
    idle: () => boolean;
    length: () => number;
  };
  _entriesCount?: number;
  _entriesProcessedCount?: number;
  _pending?: number;
  _task?: unknown;
  _module?: EventEmitter & {
    destroyed?: boolean;
    readableEnded?: boolean;
    writableEnded?: boolean;
    writableFinished?: boolean;
    readableFlowing?: boolean | null;
  };
  _state?: {
    finalize?: boolean;
    finalizing?: boolean;
    finalized?: boolean;
    aborted?: boolean;
    modulePiped?: boolean;
  };
};

const readStreamLifecycleFlags = (
  stream: NodeJS.EventEmitter & {
    destroyed?: boolean;
    readableEnded?: boolean;
    writableEnded?: boolean;
    writableFinished?: boolean;
    readableFlowing?: boolean | null;
    closed?: boolean;
  }
): Record<string, unknown> => ({
  destroyed: Boolean(stream.destroyed),
  readableEnded: Boolean(stream.readableEnded),
  writableEnded: Boolean(stream.writableEnded),
  writableFinished: Boolean(stream.writableFinished),
  readableFlowing: stream.readableFlowing,
  closed: Boolean(stream.closed),
});

const readInstalledPackageVersion = (packageName: string): string => {
  try {
    const raw = readFileSync(
      join(process.cwd(), "node_modules", packageName, "package.json"),
      "utf8"
    );
    return (JSON.parse(raw) as { version?: string }).version ?? "unknown";
  } catch {
    return "unknown";
  }
};

const ARCHIVER_FORENSIC_EVENTS = [
  "entry",
  "progress",
  "warning",
  "error",
  "finish",
  "end",
  "close",
  "prefinish",
  "drain",
  "pipe",
  "unpipe",
] as const;

let zipWriterFinalizeIdCounter = 0;

type LastEntryForensics = {
  entryName?: string;
  entrySize?: number;
  appendStartedAt?: string;
  appendReturnedAt?: string;
  entryEventReceived?: boolean;
  lastProgress?: unknown;
  pointerBefore?: number;
  pointerAfter?: number;
};

const readModuleForensics = (
  zipModule: ArchiverWithInternals["_module"]
): Record<string, unknown> | null => {
  if (!zipModule) return null;
  const record = zipModule as EventEmitter & {
    destroyed?: boolean;
    readableEnded?: boolean;
    writableEnded?: boolean;
    writableFinished?: boolean;
    ended?: boolean;
    finished?: boolean;
  };
  return {
    constructorName: zipModule.constructor?.name,
    ended: record.ended,
    finished: record.finished,
    destroyed: Boolean(record.destroyed),
    readableEnded: Boolean(record.readableEnded),
    writableFinished: Boolean(record.writableFinished),
    writableEnded: Boolean(record.writableEnded),
    ...readStreamLifecycleFlags(zipModule),
  };
};

const readArchiverForensicsSnapshot = (
  archive: ArchiverWithInternals,
  output: PassThrough
): Record<string, unknown> => {
  const entriesQueued = archive._entriesCount ?? -1;
  const entriesProcessed = archive._entriesProcessedCount ?? -1;
  const remainingEntries =
    entriesQueued >= 0 && entriesProcessed >= 0 ? entriesQueued - entriesProcessed : -1;
  const archiveRecord = archive as ArchiverWithInternals & { closed?: boolean };

  return {
    at: new Date().toISOString(),
    pointer: archive.pointer(),
    pending: archive._pending ?? -1,
    queueLength: archive._queue?.length() ?? -1,
    queueIdle: archive._queue?.idle() ?? false,
    statQueueLength: archive._statQueue?.length() ?? -1,
    statQueueIdle: archive._statQueue?.idle() ?? false,
    entriesQueued,
    entriesProcessed,
    remainingEntries,
    archiveState: archive._state ?? null,
    moduleState: readModuleForensics(archive._module),
    archiveReadableEnded: Boolean(archive.readableEnded),
    archiveReadableFinished: Boolean(archive.writableFinished),
    archiveDestroyed: Boolean(archive.destroyed),
    archiveClosed: Boolean(archiveRecord.closed),
    outputDestroyed: output.destroyed,
    outputClosed: Boolean((output as { closed?: boolean }).closed),
    outputWritableFinished: output.writableFinished,
    outputNeedDrain: output.writableNeedDrain,
    outputWritableLength: output.writableLength,
    outputHighWaterMark: output.writableHighWaterMark,
    moduleEnded: Boolean(archive._module?.readableEnded),
    moduleFinished: Boolean(archive._module?.writableFinished),
    archiveEnded: Boolean(archive.readableEnded),
    archiveFinished: Boolean(archive.writableFinished),
  };
};

const readFinalizeTracePayload = (
  finalizeId: number,
  archive: ArchiverWithInternals,
  output: PassThrough
): Record<string, unknown> => {
  const snapshot = readArchiverForensicsSnapshot(archive, output);
  return {
    finalizeId,
    pointer: snapshot.pointer,
    queueLength: snapshot.queueLength,
    pending: snapshot.pending,
    remainingEntries: snapshot.remainingEntries,
    moduleEnded: snapshot.moduleEnded,
    moduleFinished: snapshot.moduleFinished,
    archiveEnded: snapshot.archiveEnded,
    archiveFinished: snapshot.archiveFinished,
    outputDestroyed: snapshot.outputDestroyed,
    outputNeedDrain: snapshot.outputNeedDrain,
  };
};

const readListenerCounts = (emitter: NodeJS.EventEmitter): Record<string, number> => {
  if (typeof emitter.listenerCount !== "function") {
    return Object.fromEntries(ARCHIVER_FORENSIC_EVENTS.map((event) => [event, -1]));
  }
  return Object.fromEntries(ARCHIVER_FORENSIC_EVENTS.map((event) => [event, emitter.listenerCount(event)]));
};

const logArchiverInternalIdle = (
  archive: ArchiverWithInternals,
  output: PassThrough
): void => {
  console.info("[DR] ARCHIVER_FORENSICS ARCHIVER_INTERNAL_IDLE", {
    at: new Date().toISOString(),
    ...readArchiverForensicsSnapshot(archive, output),
    archiveListenerCounts: readListenerCounts(archive as unknown as NodeJS.EventEmitter),
    moduleListenerCounts: archive._module ? readListenerCounts(archive._module) : null,
    outputListenerCounts: readListenerCounts(output),
  });
};

type LifecycleEventRecord = {
  source: string;
  event: string;
  at: string;
  pointer?: number;
  [key: string]: unknown;
};

const createArchiverForensicsContext = (
  archive: ArchiverWithInternals,
  output: PassThrough
) => {
  const lastEntry: LastEntryForensics = {};
  let previousFinalizePointer = -1;
  let internalIdleLogged = false;
  let lastLifecycleEvent: LifecycleEventRecord | null = null;
  let activeFinalizeId: number | null = null;

  const withActiveFinalizeTrace = (
    payload: Record<string, unknown>
  ): Record<string, unknown> => {
    if (activeFinalizeId === null) return payload;
    return {
      ...readFinalizeTracePayload(activeFinalizeId, archive, output),
      ...payload,
    };
  };

  const setActiveFinalizeId = (finalizeId: number): void => {
    activeFinalizeId = finalizeId;
  };

  const clearActiveFinalizeId = (): void => {
    activeFinalizeId = null;
  };

  const logFinalizeTrace = (
    label: string,
    extra: Record<string, unknown> = {}
  ): void => {
    if (activeFinalizeId === null) return;
    recordLifecycleEvent("finalize-trace", label, { finalizeId: activeFinalizeId });
    console.info(`[DR] ARCHIVER_FORENSICS ${label}`, {
      ...readFinalizeTracePayload(activeFinalizeId, archive, output),
      ...extra,
    });
  };

  const recordLifecycleEvent = (
    source: string,
    event: string,
    extra: Record<string, unknown> = {}
  ): void => {
    lastLifecycleEvent = {
      source,
      event,
      at: new Date().toISOString(),
      pointer: archive.pointer(),
      ...extra,
    };
  };

  const logForensics = (
    label: string,
    extra: Record<string, unknown> = {}
  ): void => {
    const snapshot = readArchiverForensicsSnapshot(archive, output);
    const payload: Record<string, unknown> = { ...snapshot, ...extra };

    if (label === "FINALIZE_IN_PROGRESS") {
      const currentPointer = archive.pointer();
      payload.previousPointer = previousFinalizePointer;
      payload.currentPointer = currentPointer;
      payload.pointerAdvanced =
        previousFinalizePointer >= 0 ? currentPointer > previousFinalizePointer : null;
      payload.bytesAdvanced =
        previousFinalizePointer >= 0 ? currentPointer - previousFinalizePointer : null;
      previousFinalizePointer = currentPointer;
    }

    recordLifecycleEvent("forensics", label);
    console.info(`[DR] ARCHIVER_FORENSICS ${label}`, withActiveFinalizeTrace(payload));

    const queueLength = snapshot.queueLength as number;
    const pending = snapshot.pending as number;
    const remainingEntries = snapshot.remainingEntries as number;
    if (
      queueLength === 0 &&
      pending === 0 &&
      remainingEntries === 0 &&
      !internalIdleLogged
    ) {
      internalIdleLogged = true;
      logArchiverInternalIdle(archive, output);
    }
  };

  const readOutputWritableState = (): Record<string, unknown> => ({
    destroyed: output.destroyed,
    closed: Boolean((output as { closed?: boolean }).closed),
    writableNeedDrain: output.writableNeedDrain,
    writableLength: output.writableLength,
    writableHighWaterMark: output.writableHighWaterMark,
    writableEnded: output.writableEnded,
    writableFinished: output.writableFinished,
    readableEnded: output.readableEnded,
    readableLength: output.readableLength,
    readableFlowing: output.readableFlowing,
  });

  const logOutputEvent = (event: string, meta: Record<string, unknown> = {}): void => {
    recordLifecycleEvent("output", event);
    console.info("[DR] ARCHIVER_FORENSICS OUTPUT_EVENT", withActiveFinalizeTrace({
      event,
      timestamp: new Date().toISOString(),
      pointer: archive.pointer(),
      outputWritableState: readOutputWritableState(),
      ...meta,
    }));
  };

  const attachOutputForensics = (): void => {
    (["drain", "finish", "prefinish", "end", "close", "error", "pipe", "unpipe"] as const).forEach(
      (event) => {
        output.on(event, (...args: unknown[]) => {
          logOutputEvent(
            event,
            event === "error"
              ? {
                  message: args[0] instanceof Error ? args[0].message : String(args[0]),
                }
              : event === "pipe" || event === "unpipe"
                ? { peerType: (args[0] as { constructor?: { name?: string } })?.constructor?.name }
                : {}
          );
        });
      }
    );
  };

  const attachArchiveForensics = (): void => {
    (["entry", "progress", "finish", "end", "close", "warning", "error"] as const).forEach(
      (event) => {
        archive.on(event, (...args: unknown[]) => {
          recordLifecycleEvent("archive", event);
          console.info("[DR] ARCHIVER_FORENSICS ARCHIVE_EVENT", withActiveFinalizeTrace({
            event,
            timestamp: new Date().toISOString(),
            pointer: archive.pointer(),
            payload:
              event === "entry" || event === "progress"
                ? args[0]
                : event === "error" || event === "warning"
                  ? args[0] instanceof Error
                    ? args[0].message
                    : String(args[0])
                  : undefined,
          }));

          if (event === "entry") {
            const entryData = args[0] as { name?: string };
            if (entryData?.name === lastEntry.entryName) {
              lastEntry.entryEventReceived = true;
            }
          }
          if (event === "progress") {
            lastEntry.lastProgress = args[0];
          }
        });
      }
    );

    (["prefinish", "finish", "end", "close"] as const).forEach((event) => {
      archive.on(event, () => {
        console.info("[DR] ARCHIVER_FORENSICS TRANSFORM_EVENT", {
          event,
          timestamp: new Date().toISOString(),
          pointer: archive.pointer(),
          ...readStreamLifecycleFlags(archive as ArchiverWithInternals),
        });
      });
    });
  };

  let moduleForensicsAttached = false;
  const attachModuleForensics = (): void => {
    if (moduleForensicsAttached) return;
    const zipModule = archive._module;
    if (!zipModule) {
      recordLifecycleEvent("module", "module-unavailable");
      console.info("[DR] ARCHIVER_FORENSICS MODULE_EVENT", withActiveFinalizeTrace({
        event: "module-unavailable",
        timestamp: new Date().toISOString(),
        pointer: archive.pointer(),
      }));
      return;
    }
    moduleForensicsAttached = true;

    (["prefinish", "finish", "end", "close", "drain", "pipe", "unpipe", "error"] as const).forEach(
      (event) => {
        zipModule.on(event, (...args: unknown[]) => {
          recordLifecycleEvent("module", event);
          console.info("[DR] ARCHIVER_FORENSICS MODULE_EVENT", withActiveFinalizeTrace({
            event,
            timestamp: new Date().toISOString(),
            pointer: archive.pointer(),
            moduleInfo: readModuleForensics(zipModule),
            ...(event === "error"
              ? {
                  message: args[0] instanceof Error ? args[0].message : String(args[0]),
                }
              : event === "pipe" || event === "unpipe"
                ? { peerType: (args[0] as { constructor?: { name?: string } })?.constructor?.name }
                : {}),
          }));
        });
      }
    );
  };

  const recordAppendStart = (entryName: string, entrySize?: number): void => {
    lastEntry.entryName = entryName;
    lastEntry.entrySize = entrySize;
    lastEntry.appendStartedAt = new Date().toISOString();
    lastEntry.appendReturnedAt = undefined;
    lastEntry.entryEventReceived = false;
    lastEntry.lastProgress = undefined;
    lastEntry.pointerBefore = archive.pointer();
    lastEntry.pointerAfter = undefined;
  };

  const recordAppendReturn = (): void => {
    lastEntry.appendReturnedAt = new Date().toISOString();
    lastEntry.pointerAfter = archive.pointer();
  };

  const dumpTimeout = (finalizeElapsedMs?: number): void => {
    logForensics("FINALIZE_IN_PROGRESS", { reason: "timeout-dump" });
    const snapshot = readArchiverForensicsSnapshot(archive, output);
    const rawArchive = archive as ArchiverWithInternals & Record<string, unknown>;
    console.error("[DR] ARCHIVER_FORENSICS TIMEOUT_DUMP", withActiveFinalizeTrace({
      at: new Date().toISOString(),
      finalizeElapsedMs: finalizeElapsedMs ?? null,
      pointer: archive.pointer(),
      queueLength: snapshot.queueLength,
      pending: snapshot.pending,
      remainingEntries: snapshot.remainingEntries,
      entriesQueued: snapshot.entriesQueued,
      entriesProcessed: snapshot.entriesProcessed,
      archiveState: snapshot.archiveState,
      moduleState: snapshot.moduleState,
      outputWritableState: readOutputWritableState(),
      lastLifecycleEvent,
      snapshot,
      lastEntry: { ...lastEntry },
      privateFields: {
        _queue: archive._queue ?? null,
        _statQueue: archive._statQueue ?? null,
        _state: archive._state ?? null,
        _pending: archive._pending ?? null,
        _task: archive._task ?? null,
        _module: archive._module ?? null,
        _entriesCount: archive._entriesCount ?? null,
        _entriesProcessedCount: archive._entriesProcessedCount ?? null,
      },
      archivePrivateKeys: Object.keys(rawArchive).filter((key) => key.startsWith("_")),
      moduleInfo: readModuleForensics(archive._module),
      archiveListenerCounts: readListenerCounts(archive as unknown as NodeJS.EventEmitter),
      moduleListenerCounts: archive._module ? readListenerCounts(archive._module) : null,
      outputListenerCounts: readListenerCounts(output),
    }));
  };

  const logVersionsOnce = (): void => {
    console.info("[DR] ARCHIVER_FORENSICS VERSIONS", {
      archiver: readInstalledPackageVersion("archiver"),
      zipStream: readInstalledPackageVersion("zip-stream"),
      node: process.version,
    });
  };

  return {
    attachOutputForensics,
    attachArchiveForensics,
    attachModuleForensics,
    logForensics,
    logFinalizeTrace,
    setActiveFinalizeId,
    clearActiveFinalizeId,
    dumpTimeout,
    logVersionsOnce,
    recordAppendStart,
    recordAppendReturn,
  };
};

const readZipPipelineDiagnostics = (
  archive: ArchiverWithInternals,
  output: PassThrough,
  phase: string
): ZipPipelineDiagnostics => ({
  phase,
  at: new Date().toISOString(),
  archivePointer: archive.pointer(),
  queueLength: archive._queue?.length() ?? -1,
  queueIdle: archive._queue?.idle() ?? false,
  entriesQueued: archive._entriesCount ?? -1,
  entriesProcessed: archive._entriesProcessedCount ?? -1,
  pending: archive._pending ?? -1,
  archiveFinalized: Boolean(archive._state?.finalized),
  archiveFinalizing: Boolean(archive._state?.finalizing),
  archiveAborted: Boolean(archive._state?.aborted),
  outputDestroyed: output.destroyed,
  outputWritableNeedDrain: output.writableNeedDrain,
  outputWritableLength: output.writableLength,
  outputReadableLength: output.readableLength,
  outputWritableEnded: output.writableEnded,
  outputWritableFinished: output.writableFinished,
  outputReadableEnded: output.readableEnded,
  outputClosed: Boolean((output as { closed?: boolean }).closed),
  archivePaused: Boolean(archive.isPaused?.()),
});

const logZipPipelineDiagnostics = (
  archive: ArchiverWithInternals,
  output: PassThrough,
  phase: string,
  extra: Record<string, unknown> = {}
): void => {
  console.info("[DR] ZIP_PIPELINE_STATE", {
    ...readZipPipelineDiagnostics(archive, output, phase),
    ...extra,
  });
};

const assertZipAppendSource = (source: Buffer | Readable): void => {
  if (Buffer.isBuffer(source)) return;
  if (isNodeReadableStream(source)) return;
  throw new Error(
    `ZIP_APPEND_INVALID_SOURCE:expected Buffer or Node.js Readable,got ${source === null ? "null" : typeof source}`
  );
};

type ZipAppendStreamTrace = {
  appendId: number;
  entryName: string;
};

const attachZipAppendSourceTraceListeners = (
  source: Readable,
  trace: ZipAppendStreamTrace
): void => {
  source.setMaxListeners(Math.max(source.getMaxListeners(), 20));

  const logStreamEvent = (event: string): void => {
    console.info("[DR] ZIP_SOURCE_STREAM_EVENT", {
      event,
      appendId: trace.appendId,
      entryName: trace.entryName,
      at: new Date().toISOString(),
      destroyed: source.destroyed,
      readableEnded: source.readableEnded,
      closed: Boolean((source as { closed?: boolean }).closed),
    });
  };

  source.on("close", () => logStreamEvent("close"));
  source.on("end", () => logStreamEvent("end"));
  source.on("finish", () => logStreamEvent("finish"));
  source.on("error", () => logStreamEvent("error"));
  source.on("destroy", () => logStreamEvent("destroy"));
  source.on("aborted", () => logStreamEvent("aborted"));
};

export type ZipArchiveWriter = {
  append: (source: Buffer | Readable, options: { name: string }) => Promise<void>;
  finalize: () => Promise<void>;
  pointer: () => number;
  logPipelineDiagnostics: (phase: string, extra?: Record<string, unknown>) => void;
  getArchiveState?: () => { pointer: number; aborted?: boolean };
  getArchiveDiagnostics?: () => {
    archivePointer: number;
    archiveAborted?: boolean;
    archiveDestroyed?: boolean;
    archiveReadableEnded?: boolean;
    archiveListeners: Record<string, number>;
    outputDestroyed?: boolean;
    outputReadableEnded?: boolean;
    outputWritableFinished?: boolean;
    outputClosed?: boolean;
    outputListeners: Record<string, number>;
    queueLength?: number;
    queueIdle?: boolean;
    entriesQueued?: number;
    entriesProcessed?: number;
    outputWritableNeedDrain?: boolean;
    outputWritableLength?: number;
  };
};

export const createZipArchiveWriter = async (output: PassThrough): Promise<ZipArchiveWriter> => {
  const ZipArchive = await loadZipArchive();
  const archive = new ZipArchive({ zlib: { level: 6 } }) as unknown as ArchiverWithInternals;
  let appendCount = 0;
  let appendId = 0;

  const listenerNames = ["error", "end", "finish", "close", "data", "drain", "entry", "progress"];
  const countListeners = (emitter: NodeJS.EventEmitter): Record<string, number> =>
    Object.fromEntries(listenerNames.map((name) => [name, emitter.listenerCount(name)]));

  archive.on("error", (error: unknown) => {
    logDrObjectDiag("Archive error", {
      pointer: archive.pointer(),
      message: error instanceof Error ? error.message : String(error),
    });
  });

  archive.on("entry", (data: { name?: string }) => {
    logDrObjectDiag("Archive entry", {
      pointer: archive.pointer(),
      name: data.name,
      entriesProcessed: archive._entriesProcessedCount,
      entriesQueued: archive._entriesCount,
    });
  });

  archive.on("progress", (progress: {
    entries?: { total?: number; processed?: number };
  }) => {
    logDrObjectDiag("Archive progress", {
      pointer: archive.pointer(),
      entriesTotal: progress.entries?.total,
      entriesProcessed: progress.entries?.processed,
    });
  });

  archive.on("finish", () => {
    logDrObjectDiag("Archive finish", { pointer: archive.pointer() });
  });

  archive.on("end", () => {
    logDrObjectDiag("Archive end", { pointer: archive.pointer() });
  });

  archive.pipe(output);

  output.on("pipe", (source: Readable) => {
    logDrObjectDiag("Output pipe", { sourceType: source.constructor.name });
  });

  output.on("unpipe", (source: Readable) => {
    logDrObjectDiag("Output unpipe", { sourceType: source.constructor.name });
  });

  output.on("finish", () => {
    logDrObjectDiag("Output finish", {
      writableFinished: output.writableFinished,
      readableEnded: output.readableEnded,
    });
  });

  output.on("close", () => {
    logDrObjectDiag("Output close", { destroyed: output.destroyed });
  });

  output.on("error", (error) => {
    logDrObjectDiag("Output error", {
      message: error instanceof Error ? error.message : String(error),
    });
  });

  logZipPipelineDiagnostics(archive, output, "archive-created");
  const forensics = createArchiverForensicsContext(archive, output);
  forensics.logVersionsOnce();
  forensics.attachOutputForensics();
  forensics.attachArchiveForensics();

  return {
    logPipelineDiagnostics: (phase, extra = {}) => logZipPipelineDiagnostics(archive, output, phase, extra),
    append: async (source, options) => {
      assertZipAppendSource(source);

      appendCount += 1;
      appendId += 1;
      const currentAppendId = appendId;
      const entryName = options.name;
      const isReadable = isNodeReadableStream(source);
      const shouldLog = appendCount % 100 === 0 || appendCount === 1;

      logZipPipelineDiagnostics(archive, output, "append-before", {
        appendCount,
        appendId: currentAppendId,
        entryName,
        sourceType: Buffer.isBuffer(source) ? "buffer" : "stream",
        sourceBytes: Buffer.isBuffer(source) ? source.byteLength : undefined,
      });

      console.info("[DR] ZIP_APPEND_BEGIN", {
        appendId: currentAppendId,
        entryName,
        objectKey: entryName,
        sourceType: Buffer.isBuffer(source) ? "buffer" : "stream",
        isReadable,
        archivePointer: archive.pointer(),
      });

      if (shouldLog) {
        console.info("[DR] ZIP_APPEND_START", {
          count: appendCount,
          appendId: currentAppendId,
          pointer: archive.pointer(),
          name: entryName,
        });
      }

      if (isReadable) {
        attachZipAppendSourceTraceListeners(source as Readable, {
          appendId: currentAppendId,
          entryName,
        });
      }

      forensics.recordAppendStart(
        entryName,
        Buffer.isBuffer(source) ? source.byteLength : undefined
      );

      archive.append(source, options);

      forensics.recordAppendReturn();

      console.info("[DR] ZIP_APPEND_ENQUEUED", {
        appendId: currentAppendId,
      });

      logZipPipelineDiagnostics(archive, output, "append-complete", {
        appendCount,
        appendId: currentAppendId,
        entryName,
      });

      if (shouldLog) {
        console.info("[DR] ZIP_APPEND_END", {
          count: appendCount,
          appendId: currentAppendId,
          pointer: archive.pointer(),
          name: entryName,
        });
      }

      console.info("[DR] ZIP_APPEND_RETURN", {
        appendId: currentAppendId,
        entryName,
      });
    },
    finalize: async () => {
      const finalizeId = ++zipWriterFinalizeIdCounter;
      forensics.setActiveFinalizeId(finalizeId);

      try {
        logZipPipelineDiagnostics(archive, output, "finalize-before", { finalizeId });
        forensics.attachModuleForensics();
        const finalizeStartedAt = Date.now();
        forensics.logForensics("PRE_FINALIZE");
        forensics.logForensics("FINALIZE_IN_PROGRESS", { reason: "finalize-start" });
        console.log("[DR] BEFORE archive.finalize (writer)", { finalizeId });
        logDrObjectDiag("Finalize started", { pointer: archive.pointer(), finalizeId });

        let moduleEndSeen = false;
        const zipModule = archive._module;
        const onModuleEnd = (): void => {
          moduleEndSeen = true;
        };
        if (zipModule) {
          zipModule.on("end", onModuleEnd);
        }

        const finalizeSnapshotTimer = setInterval(() => {
          forensics.logForensics("FINALIZE_IN_PROGRESS");
        }, 5_000);

        forensics.logFinalizeTrace("FINALIZE_CALL_BEGIN");
        const moduleFinalize = archive.finalize();
        forensics.logFinalizeTrace("FINALIZE_PROMISE_CREATED");

        const outputDestroyedGuard = new Promise<void>((_, reject) => {
          const cleanup = (): void => {
            output.off("close", onClose);
            output.off("error", onError);
            if (zipModule) {
              zipModule.off("end", onModuleEnd);
            }
          };
          const onClose = (): void => {
            if (output.destroyed && !moduleEndSeen) {
              cleanup();
              reject(new Error("ARCHIVE_OUTPUT_DESTROYED_DURING_FINALIZE"));
            }
          };
          const onError = (err: Error): void => {
            if (!moduleEndSeen) {
              cleanup();
              reject(err);
            }
          };
          output.on("close", onClose);
          output.on("error", onError);
          void moduleFinalize.finally(cleanup);
        });

        try {
          forensics.logFinalizeTrace("FINALIZE_WAIT_BEGIN");
          await withDrTimeout(
            Promise.race([moduleFinalize, outputDestroyedGuard]),
            DR_ARCHIVE_FINALIZE_TIMEOUT_MS,
            "archiveFinalize"
          );
          forensics.logFinalizeTrace("FINALIZE_WAIT_END");
        } catch (error) {
          if (
            error instanceof DrOperationTimeoutError &&
            error.operation === "archiveFinalize"
          ) {
            forensics.logFinalizeTrace("FINALIZE_WAIT_TIMEOUT");
            const finalizeElapsedMs = Date.now() - finalizeStartedAt;
            console.info("[DR] ZIP_FINALIZE_DURATION", {
              finalizeId,
              elapsedMs: finalizeElapsedMs,
              archivePointer: archive.pointer(),
              timedOut: true,
            });
            forensics.dumpTimeout(finalizeElapsedMs);
          }
          throw error;
        } finally {
          clearInterval(finalizeSnapshotTimer);
        }

        logZipPipelineDiagnostics(archive, output, "finalize-after", { finalizeId });
        forensics.logForensics("POST_FINALIZE");
        logDrObjectDiag("Finalize finished", { pointer: archive.pointer(), finalizeId });
        console.log("[DR] AFTER archive.finalize (writer)", { pointer: archive.pointer(), finalizeId });
      } finally {
        forensics.clearActiveFinalizeId();
      }
    },
    pointer: () => archive.pointer(),
    getArchiveState: () => ({
      pointer: archive.pointer(),
      aborted: Boolean(archive._state?.aborted),
    }),
    getArchiveDiagnostics: () => ({
      archivePointer: archive.pointer(),
      archiveAborted: Boolean(archive._state?.aborted),
      archiveDestroyed: Boolean((archive as { destroyed?: boolean }).destroyed),
      archiveReadableEnded: Boolean((archive as { readableEnded?: boolean }).readableEnded),
      archiveListeners: countListeners(archive as unknown as NodeJS.EventEmitter),
      outputDestroyed: output.destroyed,
      outputReadableEnded: output.readableEnded,
      outputWritableFinished: output.writableFinished,
      outputClosed: Boolean((output as { closed?: boolean }).closed),
      outputListeners: countListeners(output),
      queueLength: archive._queue?.length(),
      queueIdle: archive._queue?.idle(),
      entriesQueued: archive._entriesCount,
      entriesProcessed: archive._entriesProcessedCount,
      outputWritableNeedDrain: output.writableNeedDrain,
      outputWritableLength: output.writableLength,
    }),
  };
};

export const appendManifestAndCollectionsToZip = async (input: {
  writer: ZipArchiveWriter;
  manifest: BackupManifest;
  entries: BackupPackageEntry[];
}): Promise<BackupManifest> => {
  const checksums = Object.fromEntries(
    input.entries.map((entry) => [entry.collectionKey, entry.checksum])
  );
  const manifestWithChecksums: BackupManifest = {
    ...input.manifest,
    checksums,
  };
  const manifestBuffer = Buffer.from(serializeManifest(manifestWithChecksums), "utf8");
  await input.writer.append(manifestBuffer, { name: "manifest.json" });
  for (const entry of input.entries) {
    await input.writer.append(entry.content, { name: entry.fileName });
  }
  return manifestWithChecksums;
};

export const buildZipFromEntries = async (input: {
  manifest: BackupManifest;
  entries: BackupPackageEntry[];
  extraFiles?: BackupPackageExtraFile[];
}): Promise<Buffer> => {
  const checksums = Object.fromEntries(
    input.entries.map((entry) => [entry.collectionKey, entry.checksum])
  );
  const manifestWithChecksums: BackupManifest = {
    ...input.manifest,
    checksums,
  };
  const manifestBuffer = Buffer.from(serializeManifest(manifestWithChecksums), "utf8");

  const ZipArchive = await loadZipArchive();
  const archive = new ZipArchive({ zlib: { level: 6 } });
  const output = new PassThrough();
  const zipPromise = streamToBuffer(output);

  archive.on("error", (error) => {
    output.destroy(error);
  });

  archive.pipe(output);
  archive.append(manifestBuffer, { name: "manifest.json" });
  for (const entry of input.entries) {
    archive.append(entry.content, { name: entry.fileName });
  }
  for (const extra of input.extraFiles || []) {
    archive.append(extra.content, { name: extra.path });
  }
  await archive.finalize();

  return zipPromise;
};

export type ExtractedBackupPackage = {
  manifest: BackupManifest;
  collections: Record<string, Buffer>;
  storageManifest?: Buffer;
  objects: Record<string, Buffer>;
};

export const extractBackupZipPackage = async (zipBuffer: Buffer): Promise<ExtractedBackupPackage> => {
  const directory = await unzipper.Open.buffer(zipBuffer);
  const manifestEntry = directory.files.find((file) => file.path === "manifest.json");
  if (!manifestEntry) {
    throw new Error("MANIFEST_MISSING");
  }

  const manifestRaw = (await manifestEntry.buffer()).toString("utf8");
  const manifest = JSON.parse(manifestRaw) as BackupManifest;

  const collections: Record<string, Buffer> = {};
  const objects: Record<string, Buffer> = {};
  let storageManifest: Buffer | undefined;

  for (const file of directory.files) {
    if (file.path === "storage-manifest.json") {
      storageManifest = await file.buffer();
      continue;
    }
    if (file.path.startsWith("objects/")) {
      objects[file.path] = await file.buffer();
      continue;
    }
    if (!file.path.startsWith("collections/") || !file.path.endsWith(".json")) continue;
    const mongoFileName = file.path.replace("collections/", "").replace(/\.json$/, "");
    collections[mongoFileName] = await file.buffer();
  }

  return { manifest, collections, storageManifest, objects };
};

export const createPackageEntry = (input: {
  collectionKey: string;
  content: Buffer;
  recordCount: number;
}): BackupPackageEntry => ({
  collectionKey: input.collectionKey,
  fileName: `collections/${resolveCollectionFileName(input.collectionKey)}`,
  content: input.content,
  recordCount: input.recordCount,
  checksum: hashContent(input.content),
});
