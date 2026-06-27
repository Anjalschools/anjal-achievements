import type { Readable } from "stream";
import { resolveDrTimeoutMs } from "@/lib/disaster-recovery/dr-async-timeout";
import { recordMissingAsset } from "@/lib/disaster-recovery/dr-cloudinary-missing-asset-registry";
import { getDrJobContext } from "@/lib/disaster-recovery/dr-job-context";
import { destroyDrStream } from "@/lib/disaster-recovery/dr-stream-lifecycle";
import type { DrArchiveStreamRegistry } from "@/lib/disaster-recovery/dr-stream-utils";
import type { StorageManifestEntry } from "@/lib/disaster-recovery/storage-manifest-types";

export const PIPELINE_PROGRESS_STALL_CODE = "PIPELINE_PROGRESS_STALLED";
export const PIPELINE_WATCHDOG_POLL_MS = 1_000;
export const PIPELINE_WATCHDOG_TIMEOUT_MS = resolveDrTimeoutMs(
  "DR_PIPELINE_WATCHDOG_TIMEOUT_MS",
  15_000
);

export type PipelineProgressState =
  | "ACTIVE"
  | "PROGRESSING"
  | "PAUSED"
  | "STALLED"
  | "ABORTING"
  | "SKIPPED"
  | "COMPLETED";

type SourceLifecycleEvent = {
  stage: string;
  event: string;
  at: string;
};

type PipelineProgressMetrics = {
  bytesReceived: number;
  bytesWritten: number;
  archivePointer: number;
  transformBytes: number;
  lastProgressTimestamp: number;
  lastSourceLifecycleEvent: SourceLifecycleEvent | null;
};

export type PipelineProgressWatchdogInput = {
  entry: StorageManifestEntry;
  sourceStream: Readable;
  archiveStream: Readable;
  rawCompleted: Promise<StorageManifestEntry>;
  streamRegistry?: DrArchiveStreamRegistry;
  getArchivePointer?: () => number;
  timeoutMs?: number;
  pollMs?: number;
};

export type PipelineProgressWatchdogHandle = {
  completed: Promise<StorageManifestEntry>;
  stop: () => void;
  getState: () => PipelineProgressState;
  getMetrics: () => PipelineProgressMetrics;
};

const logPipelineProgress = (
  label: string,
  extra: Record<string, unknown> = {}
): void => {
  console.info(`[DR] ${label}`, {
    timestamp: new Date().toISOString(),
    ...extra,
  });
};

const asReadableLike = (stream: Readable) =>
  stream as Readable & {
    readableFlowing?: boolean | null;
    bytesRead?: number | null;
  };

type WritableLike = {
  writableFinished?: boolean;
  writableEnded?: boolean;
  writable?: boolean;
  destroyed?: boolean;
};

const asWritableLike = (stream: unknown): WritableLike =>
  stream as unknown as WritableLike;

const parseCloudinaryPublicId = (storageKey: string): string => {
  if (storageKey.startsWith("cloudinary://")) {
    const [, ...rest] = storageKey.replace("cloudinary://", "").split("/");
    return rest.join("/") || storageKey;
  }
  return storageKey;
};

const resolveOriginalUrl = (storageKey: string): string =>
  /^https?:\/\//i.test(storageKey) ? storageKey : storageKey;

const buildMissingEntry = (
  entry: StorageManifestEntry,
  errorCode: string
): StorageManifestEntry => ({
  ...entry,
  status: "missing",
  fileSize: 0,
  errorMessage: errorCode,
});

export const isPipelineProgressStalledError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return message === PIPELINE_PROGRESS_STALL_CODE;
};

export const isPipelineProgressStalledEntry = (
  entry: StorageManifestEntry
): boolean => entry.errorMessage === PIPELINE_PROGRESS_STALL_CODE;

const recordPipelineProgressStall = (input: {
  entry: StorageManifestEntry;
  metrics: PipelineProgressMetrics;
  stallDuration: number;
  pipelineId: string;
}): void => {
  const now = new Date().toISOString();
  recordMissingAsset({
    objectKey: input.entry.archivePath,
    provider: input.entry.provider,
    publicId: parseCloudinaryPublicId(input.entry.storageKey),
    originalUrl: resolveOriginalUrl(input.entry.storageKey),
    failureReason: "pipeline_progress_stalled",
    errorCode: PIPELINE_PROGRESS_STALL_CODE,
    attempts: 1,
    bytesReceived: input.metrics.bytesReceived,
    contentLength: input.entry.fileSize ?? null,
    firstFailureAt: now,
    finalFailureAt: now,
    stage: "pipeline_watchdog",
  });

  logPipelineProgress("PIPELINE_PROGRESS_SKIPPED", {
    pipelineId: input.pipelineId,
    objectId: input.entry.id,
    objectKey: input.entry.archivePath,
    reason: PIPELINE_PROGRESS_STALL_CODE,
    stallDuration: input.stallDuration,
    bytesReceived: input.metrics.bytesReceived,
    bytesWritten: input.metrics.bytesWritten,
    archivePointer: input.metrics.archivePointer,
  });
};

export const attachPipelineProgressWatchdog = (
  input: PipelineProgressWatchdogInput
): PipelineProgressWatchdogHandle => {
  const pipelineId = `${input.entry.id}:${Date.now()}`;
  const timeoutMs = input.timeoutMs ?? PIPELINE_WATCHDOG_TIMEOUT_MS;
  const pollMs = input.pollMs ?? PIPELINE_WATCHDOG_POLL_MS;
  const getArchivePointer =
    input.getArchivePointer ?? (() => getDrJobContext().archivePointer);

  let state: PipelineProgressState = "ACTIVE";
  let settled = false;
  let pollTimer: ReturnType<typeof setInterval> | undefined;
  let resolveGuarded: ((entry: StorageManifestEntry) => void) | undefined;
  let rejectGuarded: ((error: unknown) => void) | undefined;

  const metrics: PipelineProgressMetrics = {
    bytesReceived: 0,
    bytesWritten: 0,
    archivePointer: getArchivePointer(),
    transformBytes: 0,
    lastProgressTimestamp: Date.now(),
    lastSourceLifecycleEvent: null,
  };

  let progressAnchor: PipelineProgressMetrics = { ...metrics };

  const getMetrics = (): PipelineProgressMetrics => ({
    ...metrics,
    archivePointer: getArchivePointer(),
  });

  const logProgress = (label: string, extra: Record<string, unknown> = {}): void => {
    const snapshot = getMetrics();
    logPipelineProgress(label, {
      pipelineId,
      objectId: input.entry.id,
      objectKey: input.entry.archivePath,
      bytesReceived: snapshot.bytesReceived,
      bytesWritten: snapshot.bytesWritten,
      archivePointer: snapshot.archivePointer,
      elapsed: Date.now() - metrics.lastProgressTimestamp,
      lastProgressTimestamp: new Date(snapshot.lastProgressTimestamp).toISOString(),
      lastSourceLifecycleEvent: snapshot.lastSourceLifecycleEvent,
      state,
      ...extra,
    });
  };

  const noteProgress = (reason: string): void => {
    if (state === "ABORTING" || state === "SKIPPED" || state === "COMPLETED") return;

    const snapshot = getMetrics();
    const pipelineProgressChanged =
      snapshot.bytesWritten !== progressAnchor.bytesWritten ||
      snapshot.archivePointer !== progressAnchor.archivePointer;

    if (!pipelineProgressChanged && state !== "ACTIVE") return;

    metrics.lastProgressTimestamp = Date.now();
    metrics.archivePointer = snapshot.archivePointer;
    progressAnchor = {
      ...snapshot,
      bytesReceived: progressAnchor.bytesReceived,
      transformBytes: snapshot.bytesWritten,
    };
    state = state === "PAUSED" ? "PROGRESSING" : "PROGRESSING";

    logProgress("PIPELINE_PROGRESS_UPDATED", { reason });
  };

  const recordSourceLifecycle = (event: string): void => {
    metrics.lastSourceLifecycleEvent = {
      stage: "SOURCE",
      event,
      at: new Date().toISOString(),
    };
    if (event === "pause") {
      state = "PAUSED";
    } else if (event === "resume") {
      state = "PROGRESSING";
    }
    logProgress("PIPELINE_PROGRESS", { sourceEvent: event });
  };

  const onSourceData = (chunk: Buffer | string): void => {
    const size = Buffer.isBuffer(chunk) ? chunk.byteLength : Buffer.byteLength(chunk);
    metrics.bytesReceived += size;
  };

  const onArchiveData = (chunk: Buffer | string): void => {
    const size = Buffer.isBuffer(chunk) ? chunk.byteLength : Buffer.byteLength(chunk);
    metrics.bytesWritten += size;
    metrics.transformBytes = metrics.bytesWritten;
    noteProgress("archive-data");
  };

  const detachListeners = (): void => {
    input.sourceStream.off("data", onSourceData);
    input.sourceStream.off("pause", onSourcePause);
    input.sourceStream.off("resume", onSourceResume);
    input.sourceStream.off("end", onSourceEnd);
    input.sourceStream.off("close", onSourceClose);
    input.archiveStream.off("data", onArchiveData);
    input.archiveStream.off("end", onArchiveEnd);
    input.archiveStream.off("close", onArchiveClose);
  };

  const onSourcePause = (): void => recordSourceLifecycle("pause");
  const onSourceResume = (): void => recordSourceLifecycle("resume");
  const onSourceEnd = (): void => {
    recordSourceLifecycle("end");
    noteProgress("source-end");
  };
  const onSourceClose = (): void => {
    recordSourceLifecycle("close");
    noteProgress("source-close");
  };
  const onArchiveEnd = (): void => noteProgress("archive-end");
  const onArchiveClose = (): void => noteProgress("archive-close");

  input.sourceStream.on("data", onSourceData);
  input.sourceStream.on("pause", onSourcePause);
  input.sourceStream.on("resume", onSourceResume);
  input.sourceStream.on("end", onSourceEnd);
  input.sourceStream.on("close", onSourceClose);
  input.archiveStream.on("data", onArchiveData);
  input.archiveStream.on("end", onArchiveEnd);
  input.archiveStream.on("close", onArchiveClose);

  logProgress("PIPELINE_PROGRESS", { phase: "watchdog-attached" });

  const stop = (): void => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = undefined;
    }
    detachListeners();
  };

  const settleGuarded = (entry: StorageManifestEntry): void => {
    if (settled) return;
    settled = true;
    stop();
    resolveGuarded?.(entry);
  };

  const rejectGuardedOnce = (error: unknown): void => {
    if (settled) return;
    settled = true;
    stop();
    rejectGuarded?.(error);
  };

  const isPipelineStalled = (): boolean => {
    if (
      state === "ABORTING" ||
      state === "SKIPPED" ||
      state === "COMPLETED" ||
      input.sourceStream.readableEnded ||
      asWritableLike(input.archiveStream).writableFinished
    ) {
      return false;
    }

    const snapshot = getMetrics();
    const stallDuration = Date.now() - snapshot.lastProgressTimestamp;
    if (stallDuration < timeoutMs) return false;

    const sourcePaused =
      snapshot.lastSourceLifecycleEvent?.event === "pause" ||
      asReadableLike(input.sourceStream).readableFlowing === false;

    if (!sourcePaused) return false;

    const progressFrozen =
      snapshot.bytesWritten === progressAnchor.bytesWritten &&
      snapshot.archivePointer === progressAnchor.archivePointer &&
      snapshot.transformBytes === progressAnchor.transformBytes;

    return progressFrozen;
  };

  const abortStalledPipeline = (): void => {
    if (settled || state === "ABORTING" || state === "SKIPPED") return;

    const snapshot = getMetrics();
    const stallDuration = Date.now() - snapshot.lastProgressTimestamp;
    state = "STALLED";

    logProgress("PIPELINE_PROGRESS_STALLED", { stallDuration });

    state = "ABORTING";
    logProgress("PIPELINE_PROGRESS_ABORT_BEGIN", { stallDuration });

    const sharedError = new Error(PIPELINE_PROGRESS_STALL_CODE);

    destroyDrStream(input.sourceStream, sharedError);
    logProgress("PIPELINE_SOURCE_DESTROY", { message: sharedError.message });
    logProgress("PIPELINE_TRANSFORM_DESTROY", {
      message: sharedError.message,
      delegated: "via-source-destroy",
    });
    destroyDrStream(input.archiveStream, sharedError);
    logProgress("PIPELINE_OUTPUT_DESTROY", { message: sharedError.message });

    input.streamRegistry?.markProducerError(input.archiveStream, sharedError.message);
    input.streamRegistry?.markProducerCompleted(input.archiveStream);

    recordPipelineProgressStall({
      entry: input.entry,
      metrics: snapshot,
      stallDuration,
      pipelineId,
    });

    logProgress("PIPELINE_PROGRESS_ABORT_END", { stallDuration });
    logProgress("PIPELINE_PROGRESS_CONTINUE", {
      nextObjectKey: input.entry.archivePath,
    });

    state = "SKIPPED";
    settleGuarded(buildMissingEntry(input.entry, PIPELINE_PROGRESS_STALL_CODE));
  };

  pollTimer = setInterval(() => {
    const currentPointer = getArchivePointer();
    if (currentPointer !== metrics.archivePointer) {
      metrics.archivePointer = currentPointer;
      noteProgress("archive-pointer");
    }
    if (isPipelineStalled()) {
      abortStalledPipeline();
    }
  }, pollMs);

  const guarded = new Promise<StorageManifestEntry>((resolve, reject) => {
    resolveGuarded = resolve;
    rejectGuarded = reject;
  });

  input.rawCompleted
    .then((entry) => {
      if (settled) return;
      state = "COMPLETED";
      noteProgress("pipeline-complete");
      settleGuarded(entry);
    })
    .catch((error) => {
      if (settled) return;
      rejectGuardedOnce(error);
    });

  return {
    completed: guarded,
    stop,
    getState: () => state,
    getMetrics,
  };
};
