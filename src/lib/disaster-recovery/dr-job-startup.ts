import connectDB from "@/lib/mongodb";
import BackupRecord from "@/models/BackupRecord";
import { truncateDrErrorStack } from "@/lib/disaster-recovery/dr-diag-policy";
import {
  acquireDrJobLock,
  inspectDrJobLock,
  releaseDrJobLock,
  type DrJobLockStatus,
} from "@/lib/disaster-recovery/dr-job-lock";
import { getDrJobContext } from "@/lib/disaster-recovery/dr-job-context";

export type DrStartupMilestone =
  | "HTTP_REQUEST_RECEIVED"
  | "BACKUP_RECORD_CREATED"
  | "QUEUE_JOB_CREATED"
  | "QUEUE_JOB_SCHEDULED"
  | "QUEUE_JOB_DISPATCHED"
  | "BACKGROUND_JOB_STARTING"
  | "BACKGROUND_JOB_STARTED"
  | "STREAMING_BACKUP_ENTER"
  | "OBJECT_EXPORT_STARTED"
  | "BACKGROUND_JOB_START_FAILED"
  | "QUEUE_START_TIMEOUT";

type DrStartupSession = {
  recordId?: string;
  queuedAt?: number;
  scheduledAt?: number;
  workerStartedAt?: number;
  backupStartedAt?: number;
  milestones: DrStartupMilestone[];
  lastMilestone?: DrStartupMilestone;
  failureReason?: string;
  dispatchMethod: "queue" | "setImmediate";
  lockStatus?: DrJobLockStatus;
};

const createEmptySession = (): DrStartupSession => ({
  milestones: [],
  dispatchMethod: "queue",
});

let session: DrStartupSession = createEmptySession();

const activeJobPromises = new Map<string, Promise<void>>();

export const initDrJobStartup = (recordId: string): void => {
  const queuedAt = session.queuedAt ?? Date.now();
  session = createEmptySession();
  session.recordId = recordId;
  session.queuedAt = queuedAt;
};

export const resetDrJobStartup = (): void => {
  session = createEmptySession();
};

export const markDrJobQueued = (): void => {
  if (!session.queuedAt) {
    session.queuedAt = Date.now();
  }
};

export const markDrJobScheduled = (): void => {
  session.scheduledAt = Date.now();
};

export const markDrWorkerStarted = (): void => {
  session.workerStartedAt = Date.now();
};

export const markDrBackupStarted = (): void => {
  session.backupStartedAt = Date.now();
};

export const logDrStartupMilestone = (
  milestone: DrStartupMilestone,
  extra: Record<string, unknown> = {}
): void => {
  session.milestones.push(milestone);
  session.lastMilestone = milestone;
  const timing = getDrStartupTiming();
  console.info(`[DR] ${milestone}`, {
    recordId: session.recordId,
    ...timing,
    ...extra,
  });
};

export const getDrStartupMilestones = (): DrStartupMilestone[] => [...session.milestones];

export const getDrStartupTiming = (): {
  queueDelayMs?: number;
  dispatchDelayMs?: number;
  startupDelayMs?: number;
} => {
  const { queuedAt, scheduledAt, workerStartedAt, backupStartedAt } = session;
  return {
    queueDelayMs:
      queuedAt && scheduledAt ? Math.max(0, scheduledAt - queuedAt) : undefined,
    dispatchDelayMs:
      scheduledAt && workerStartedAt ? Math.max(0, workerStartedAt - scheduledAt) : undefined,
    startupDelayMs:
      workerStartedAt && backupStartedAt
        ? Math.max(0, backupStartedAt - workerStartedAt)
        : undefined,
  };
};

export const printDrStartupReport = (): void => {
  if (session.milestones.length === 0 && !session.recordId) return;

  const timing = getDrStartupTiming();
  const ctx = getDrJobContext();
  const lockStatus = session.lockStatus ?? inspectDrJobLock(session.recordId);
  const reachedBackup =
    session.milestones.includes("BACKGROUND_JOB_STARTED") ||
    session.milestones.includes("STREAMING_BACKUP_ENTER") ||
    session.milestones.includes("OBJECT_EXPORT_STARTED");

  if (reachedBackup) {
    return;
  }

  console.info("========== DR STARTUP REPORT ==========");
  console.info(`lastMilestone: ${session.lastMilestone ?? "NONE"}`);
  console.info(`queueDelayMs: ${timing.queueDelayMs ?? "n/a"}`);
  console.info(`dispatchDelayMs: ${timing.dispatchDelayMs ?? "n/a"}`);
  console.info(`startupDelayMs: ${timing.startupDelayMs ?? "n/a"}`);
  console.info(`lockStatus: ${lockStatus.locked ? "locked" : "unlocked"}`);
  if (lockStatus.owner) console.info(`lockOwner: ${lockStatus.owner}`);
  if (lockStatus.lockAgeMs !== undefined) console.info(`lockAgeMs: ${lockStatus.lockAgeMs}`);
  console.info(`jobState: ${ctx.phase}`);
  console.info(`failureReason: ${session.failureReason ?? "none"}`);
  console.info("======================================");
};

export const handleDrStartupFailure = async (
  recordId: string,
  error: unknown
): Promise<void> => {
  const message = error instanceof Error ? error.message : String(error);
  const stack = truncateDrErrorStack(error);
  const cause =
    error instanceof Error && error.cause
      ? error.cause instanceof Error
        ? error.cause.message
        : String(error.cause)
      : undefined;

  session.failureReason = message;
  logDrStartupMilestone("BACKGROUND_JOB_START_FAILED", {
    message,
    stack,
    cause,
  });

  try {
    await connectDB();
    await BackupRecord.findByIdAndUpdate(recordId, {
      status: "failed",
      jobPhase: "startup_failed",
      errorMessage: message,
      jobCompletedAt: new Date(),
    });
  } catch (persistError) {
    const persistMessage =
      persistError instanceof Error ? persistError.message : String(persistError);
    console.error("[DR] STARTUP_FAILURE_PERSIST_FAILED", {
      recordId,
      message: persistMessage,
    });
  } finally {
    releaseDrJobLock(recordId);
    printDrStartupReport();
  }
};

const retainDrJobPromise = (recordId: string, promise: Promise<void>): void => {
  activeJobPromises.set(recordId, promise);
  promise.finally(() => {
    activeJobPromises.delete(recordId);
  });
};

export const dispatchDrBackgroundJob = (
  recordId: string,
  runner: () => Promise<void>
): void => {
  markDrJobScheduled();
  logDrStartupMilestone("QUEUE_JOB_SCHEDULED", { recordId });

  setImmediate(() => {
    logDrStartupMilestone("QUEUE_JOB_DISPATCHED", { recordId });
    markDrWorkerStarted();
    logDrStartupMilestone("BACKGROUND_JOB_STARTING", { recordId });

    let promise: Promise<void>;
    try {
      promise = runner();
    } catch (error) {
      promise = handleDrStartupFailure(recordId, error).then(() => undefined);
      retainDrJobPromise(recordId, promise);
      return;
    }

    promise = promise.catch((error) => handleDrStartupFailure(recordId, error));
    retainDrJobPromise(recordId, promise);
  });
};

export const beginDrBackgroundJob = async (recordId: string): Promise<void> => {
  session.lockStatus = inspectDrJobLock(recordId);
  if (!acquireDrJobLock(recordId)) {
    throw new Error(`DR_JOB_LOCK_HELD:owner=${session.lockStatus.owner ?? "unknown"}`);
  }

  markDrBackupStarted();
  logDrStartupMilestone("BACKGROUND_JOB_STARTED", { recordId });

  await connectDB();
  await BackupRecord.findByIdAndUpdate(recordId, {
    jobPhase: "starting",
    jobStartedAt: new Date(),
    heartbeatAt: new Date(),
  });
};

export const getActiveDrJobPromise = (recordId: string): Promise<void> | undefined =>
  activeJobPromises.get(recordId);
