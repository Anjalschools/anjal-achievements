import type { Readable } from "stream";
import { getDrJobContext } from "@/lib/disaster-recovery/dr-job-context";
import {
  DR_MAX_HANDLE_DETAIL_LOGS,
  DR_MAX_TRACKED_PROMISES,
  DR_MAX_TRACKED_STREAMS,
  logDrRegistryLimit,
  truncateDrErrorStack,
} from "@/lib/disaster-recovery/dr-diag-policy";
import { readProcessMemorySnapshot } from "@/lib/disaster-recovery/dr-memory-metrics";
import { getMissingAssetRecords } from "@/lib/disaster-recovery/dr-cloudinary-missing-asset-registry";

export type DrMilestone =
  | "OBJECT_EXPORT_COMPLETED"
  | "ZIP_FINALIZE_STARTED"
  | "ZIP_FINALIZE_COMPLETED"
  | "UPLOAD_STARTED"
  | "UPLOAD_COMPLETED"
  | "R2_UPLOAD_COMPLETED"
  | "BACKUP_RECORD_CREATED"
  | "BACKUP_RECORD_SAVED"
  | "BACKUP_STATUS_COMPLETED"
  | "BACKUP_JOB_COMPLETED"
  | "HTTP_RESPONSE_READY"
  | "HTTP_RESPONSE_SENT";

export type DrPromiseStatus = "pending" | "resolved" | "rejected" | "timeout";

type DrPromiseEntry = {
  name: string;
  startedAt: number;
  status: DrPromiseStatus;
};

type DrStreamEntry = {
  id: string;
  type: string;
  objectKey: string;
  stage: string;
  createdAt: number;
};

export type DrFinalReportFlags = {
  objectsProcessed: number;
  objectsFailed: number;
  bytesExported: number;
  zipFinalized: boolean;
  uploadCompleted: boolean;
  backupSaved: boolean;
  responseSent: boolean;
};

type DrVerificationSession = {
  active: boolean;
  recordId?: string;
  jobStartedAt: number;
  milestones: Set<DrMilestone>;
  lastMilestone?: DrMilestone;
  promises: Map<string, DrPromiseEntry>;
  streams: Map<string, DrStreamEntry>;
  streamSeq: number;
  peakRss: number;
  peakHeap: number;
  report: DrFinalReportFlags;
};

const createEmptySession = (): DrVerificationSession => ({
  active: false,
  jobStartedAt: 0,
  milestones: new Set(),
  promises: new Map(),
  streams: new Map(),
  streamSeq: 0,
  peakRss: 0,
  peakHeap: 0,
  report: {
    objectsProcessed: 0,
    objectsFailed: 0,
    bytesExported: 0,
    zipFinalized: false,
    uploadCompleted: false,
    backupSaved: false,
    responseSent: false,
  },
});

let session: DrVerificationSession = createEmptySession();

const captureMemoryPeaks = (): ReturnType<typeof readProcessMemorySnapshot> => {
  const snapshot = readProcessMemorySnapshot();
  session.peakRss = Math.max(session.peakRss, snapshot.rss);
  session.peakHeap = Math.max(session.peakHeap, snapshot.heapUsed);
  return snapshot;
};

const buildMilestoneMeta = (extra: Record<string, unknown> = {}): Record<string, unknown> => {
  const ctx = getDrJobContext();
  const memory = captureMemoryPeaks();
  const elapsedMs = session.jobStartedAt > 0 ? Date.now() - session.jobStartedAt : 0;
  return {
    recordId: session.recordId ?? ctx.recordId,
    processedObjects: ctx.processedObjects,
    totalObjects: ctx.totalObjects,
    archivePointer: ctx.archivePointer,
    elapsedMs,
    rss: memory.rss,
    heapUsed: memory.heapUsed,
    ...extra,
  };
};

export const isDrVerificationActive = (): boolean => session.active;

export const initDrVerification = (recordId?: string): void => {
  session = createEmptySession();
  session.active = true;
  session.recordId = recordId;
  session.jobStartedAt = Date.now();
  captureMemoryPeaks();
};

export const resetDrVerification = (): void => {
  session = createEmptySession();
};

export const updateDrVerificationReport = (partial: Partial<DrFinalReportFlags>): void => {
  session.report = { ...session.report, ...partial };
};

export const logDrMilestone = (milestone: DrMilestone, extra?: Record<string, unknown>): void => {
  session.milestones.add(milestone);
  session.lastMilestone = milestone;
  console.info(`[DR] ${milestone}`, buildMilestoneMeta(extra));
};

export const logDrException = (phase: string, error: unknown): void => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[DR] EXCEPTION", {
    phase,
    lastMilestone: session.lastMilestone ?? "NONE",
    lastReachedStage: getDrJobContext().phase,
    message,
    stack: truncateDrErrorStack(error),
    ...buildMilestoneMeta(),
  });
};

export const trackDrPromise = <T>(name: string, promise: Promise<T>): Promise<T> => {
  if (!session.active) return promise;
  if (session.promises.size >= DR_MAX_TRACKED_PROMISES) {
    logDrRegistryLimit("promises", DR_MAX_TRACKED_PROMISES);
    return promise;
  }

  const key = `${name}:${session.promises.size + 1}`;
  session.promises.set(key, { name, startedAt: Date.now(), status: "pending" });

  return promise
    .then(
      (value) => {
        session.promises.delete(key);
        return value;
      },
      (error) => {
        session.promises.delete(key);
        throw error;
      }
    )
    .finally(() => {
      session.promises.delete(key);
    });
};

export const markDrPromiseTimeout = (name: string): void => {
  if (!session.active) return;
  for (const [key, entry] of session.promises) {
    if (entry.name === name || key.startsWith(`${name}:`)) {
      session.promises.delete(key);
    }
  }
};

export const registerDrTrackedStream = (
  stream: Readable,
  context: { objectKey: string; stage: string }
): string => {
  if (!session.active) return "";
  if (session.streams.size >= DR_MAX_TRACKED_STREAMS) {
    logDrRegistryLimit("streams", DR_MAX_TRACKED_STREAMS);
    return "";
  }

  session.streamSeq += 1;
  const id = `stream-${session.streamSeq}`;
  session.streams.set(id, {
    id,
    type: stream.constructor?.name || "Readable",
    objectKey: context.objectKey,
    stage: context.stage,
    createdAt: Date.now(),
  });

  const remove = (): void => {
    session.streams.delete(id);
  };

  stream.once("close", remove);
  stream.once("end", remove);
  stream.once("finish", remove);
  stream.once("error", remove);

  return id;
};

export const getPendingDrPromises = (): DrPromiseEntry[] =>
  Array.from(session.promises.values()).filter((entry) => entry.status === "pending");

export const getOpenDrStreams = (): DrStreamEntry[] => Array.from(session.streams.values());

export const getDrVerificationRegistryCounts = (): {
  activePromises: number;
  activeStreams: number;
} => ({
  activePromises: session.promises.size,
  activeStreams: session.streams.size,
});

const logPendingDrPromisesDetail = (): void => {
  const pending = getPendingDrPromises();
  if (pending.length === 0) return;
  console.warn("[DR] Pending async operations", {
    count: pending.length,
    ...buildMilestoneMeta(),
  });
  for (const entry of pending.slice(0, DR_MAX_HANDLE_DETAIL_LOGS)) {
    console.warn("[DR] PENDING_PROMISE", {
      name: entry.name,
      elapsedMs: Date.now() - entry.startedAt,
      status: entry.status,
    });
  }
};

const logOpenDrStreamsDetail = (): void => {
  const open = getOpenDrStreams();
  if (open.length === 0) return;
  console.warn("[DR] Open Streams", { count: open.length, ...buildMilestoneMeta() });
  for (const entry of open.slice(0, DR_MAX_HANDLE_DETAIL_LOGS)) {
    console.warn("[DR] OPEN_STREAM", {
      id: entry.id,
      type: entry.type,
      objectKey: entry.objectKey,
      stage: entry.stage,
      ageMs: Date.now() - entry.createdAt,
    });
  }
};

export type ArchiveVerifyState = {
  archivePointer: number;
  archiveAborted?: boolean;
  outputReadableEnded: boolean;
  outputDestroyed: boolean;
  outputWritableFinished: boolean;
};

export const verifyArchiveLifecycle = async (
  input: {
    getArchiveState: () => { pointer: number; aborted?: boolean };
    output: NodeJS.ReadWriteStream;
    timeoutMs?: number;
  }
): Promise<ArchiveVerifyState> => {
  const timeoutMs = input.timeoutMs ?? 30_000;
  const deadline = Date.now() + timeoutMs;
  let lastState: ArchiveVerifyState | null = null;

  while (Date.now() < deadline) {
    const archiveState = input.getArchiveState();
    const output = input.output as NodeJS.ReadWriteStream & {
      readableEnded?: boolean;
      destroyed?: boolean;
      writableFinished?: boolean;
    };
    lastState = {
      archivePointer: archiveState.pointer,
      archiveAborted: archiveState.aborted,
      outputReadableEnded: Boolean(output.readableEnded),
      outputDestroyed: Boolean(output.destroyed),
      outputWritableFinished: Boolean(output.writableFinished),
    };

    if (
      lastState.outputReadableEnded &&
      lastState.outputWritableFinished &&
      !lastState.outputDestroyed
    ) {
      return lastState;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  console.error("[DR] ARCHIVE_VERIFY_FAILED", {
    reason: "archive/output not settled within timeout",
    archivePointer: lastState?.archivePointer,
    outputReadableEnded: lastState?.outputReadableEnded,
    outputDestroyed: lastState?.outputDestroyed,
    outputWritableFinished: lastState?.outputWritableFinished,
    ...buildMilestoneMeta(),
  });
  return lastState ?? {
    archivePointer: 0,
    outputReadableEnded: false,
    outputDestroyed: false,
    outputWritableFinished: false,
  };
};

export const printDrFinalReport = (): void => {
  if (!session.active && session.jobStartedAt === 0) return;

  const elapsedMs = session.jobStartedAt > 0 ? Date.now() - session.jobStartedAt : 0;
  const pendingCount = session.promises.size;
  const openStreamCount = session.streams.size;
  const { report } = session;
  const jobCompleted = session.milestones.has("BACKUP_JOB_COMPLETED");
  const hasLeaks = pendingCount > 0 || openStreamCount > 0;

  console.info("========== DR FINAL REPORT ==========");
  console.info(`Objects Processed: ${report.objectsProcessed}`);
  console.info(`Objects Failed: ${report.objectsFailed}`);
  console.info(`Bytes Exported: ${report.bytesExported}`);
  console.info(`ZIP Finalized: ${report.zipFinalized ? "yes" : "no"}`);
  console.info(`Upload Completed: ${report.uploadCompleted ? "yes" : "no"}`);
  console.info(`Backup Saved: ${report.backupSaved ? "yes" : "no"}`);
  console.info(`Response Sent: ${report.responseSent ? "yes" : "no"}`);
  console.info(`Open Streams: ${openStreamCount}`);
  console.info(`Pending Promises: ${pendingCount}`);
  console.info(`Elapsed Time: ${elapsedMs}ms`);
  console.info(`Peak RSS: ${session.peakRss}`);
  console.info(`Peak Heap: ${session.peakHeap}`);
  console.info(`Last Milestone: ${session.lastMilestone ?? "NONE"}`);
  const missingAssets = getMissingAssetRecords();
  const downloadMissingAssets = missingAssets.filter(
    (asset) =>
      asset.stage !== "hashingPipeline" && asset.stage !== "pipeline_watchdog"
  );
  const hashingPipelineFailures = missingAssets.filter(
    (asset) => asset.stage === "hashingPipeline"
  );
  const pipelineWatchdogFailures = missingAssets.filter(
    (asset) => asset.stage === "pipeline_watchdog"
  );

  if (downloadMissingAssets.length > 0) {
    console.info("Missing Assets");
    console.info(`Count: ${downloadMissingAssets.length}`);
    downloadMissingAssets.forEach((asset, index) => {
      console.info(`${index + 1}.`);
      console.info(`objectKey: ${asset.objectKey}`);
      console.info(`Reason: ${asset.errorCode}`);
      console.info(`Attempts: ${asset.attempts}`);
    });
  }

  if (hashingPipelineFailures.length > 0) {
    console.info("HASHING PIPELINE FAILURES");
    console.info(`Count: ${hashingPipelineFailures.length}`);
    hashingPipelineFailures.forEach((asset, index) => {
      console.info(`${index + 1}.`);
      console.info(`objectKey: ${asset.objectKey}`);
      console.info(`Reason: ${asset.errorCode}`);
      console.info(`stage: ${asset.stage ?? "hashingPipeline"}`);
      console.info(`Attempts: ${asset.attempts}`);
    });
  }

  if (pipelineWatchdogFailures.length > 0) {
    console.info("PIPELINE WATCHDOG FAILURES");
    console.info(`Count: ${pipelineWatchdogFailures.length}`);
    pipelineWatchdogFailures.forEach((asset, index) => {
      console.info(`${index + 1}.`);
      console.info(`objectKey: ${asset.objectKey}`);
      console.info(`Reason: ${asset.errorCode}`);
      console.info(`stage: ${asset.stage ?? "pipeline_watchdog"}`);
      console.info(`Attempts: ${asset.attempts}`);
    });
  }
  console.info("=====================================");

  if (!jobCompleted) {
    console.warn("[DR] BACKUP_JOB_NOT_COMPLETED", {
      lastMilestone: session.lastMilestone ?? "NONE",
      ...buildMilestoneMeta(),
    });
  }

  if (hasLeaks || !jobCompleted) {
    logPendingDrPromisesDetail();
    logOpenDrStreamsDetail();
  }
};

export const getDrMilestones = (): DrMilestone[] => Array.from(session.milestones);

export const logDrHttpMilestone = (
  milestone: "HTTP_RESPONSE_READY" | "HTTP_RESPONSE_SENT",
  recordId: string,
  extra?: Record<string, unknown>
): void => {
  const memory = captureMemoryPeaks();
  if (session.active) {
    session.milestones.add(milestone);
    if (milestone === "HTTP_RESPONSE_SENT") {
      session.report.responseSent = true;
    }
  }
  console.info(`[DR] ${milestone}`, {
    recordId,
    processedObjects: getDrJobContext().processedObjects,
    totalObjects: getDrJobContext().totalObjects,
    archivePointer: getDrJobContext().archivePointer,
    elapsedMs: session.jobStartedAt > 0 ? Date.now() - session.jobStartedAt : 0,
    rss: memory.rss,
    heapUsed: memory.heapUsed,
    ...extra,
  });
};
