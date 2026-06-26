import "server-only";

import connectDB from "@/lib/mongodb";
import BackupRecord from "@/models/BackupRecord";
import { readProcessMemorySnapshot } from "@/lib/disaster-recovery/dr-memory-metrics";
import { registerDrProcessDiagnostics } from "@/lib/disaster-recovery/dr-process-diagnostics";
import {
  dequeueBackupJob,
  getBackupJobQueue,
  logDrQueueBacklog,
} from "@/lib/disaster-recovery/worker/dr-job-queue";
import { runDrQueueIntegrityAuditAndRepair } from "@/lib/disaster-recovery/worker/dr-queue-integrity";
import {
  computeDrWorkerLockBusyBackoffMs,
  createDrWorkerId,
  reclaimStaleDrWorkerJobLock,
  releaseDrWorkerJobLock,
  resolveDrWorkerMaxLockAttempts,
} from "@/lib/disaster-recovery/worker/dr-worker-lock";
import {
  DrWorkerCorruptPayloadError,
  DrWorkerInvalidRecordStateError,
  DrWorkerLockBusyError,
  DrWorkerOrphanQueueError,
} from "@/lib/disaster-recovery/worker/dr-worker-errors";
import {
  logDrWorkerFailure,
  logDrWorkerHealth,
} from "@/lib/disaster-recovery/worker/dr-worker-diagnostics";
import { classifyDrWorkerFailure } from "@/lib/disaster-recovery/worker/dr-worker-retry-classification";
import type { BackupJobQueueItem } from "@/lib/disaster-recovery/worker/dr-job-queue-types";

const DEFAULT_POLL_MS = 2_000;
const HEALTH_LOG_MS = 30_000;
const DEFAULT_SHUTDOWN_GRACE_MS = 30_000;

export type DrProcessNextBackupJobResult =
  | "empty"
  | "processed"
  | "lock_busy"
  | "lock_failed"
  | "retry_scheduled"
  | "terminal_failed";

const resolveWorkerPollMs = (): number => {
  const raw = process.env.DR_WORKER_POLL_MS;
  if (!raw) return DEFAULT_POLL_MS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_POLL_MS;
};

const resolveShutdownGraceMs = (): number => {
  const raw = process.env.DR_WORKER_SHUTDOWN_GRACE_MS;
  if (!raw) return DEFAULT_SHUTDOWN_GRACE_MS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SHUTDOWN_GRACE_MS;
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

let workerProcessing = false;
let shuttingDown = false;
let lastLockBusyBackoffMs = 0;
let currentJob: BackupJobQueueItem | null = null;
let workerStartedAt = Date.now();
let workerRetryCount = 0;
let workerTerminalFailureCount = 0;

export const isDrBackupWorkerProcessing = (): boolean => workerProcessing;

export const requestDrPersistentWorkerShutdown = (): void => {
  shuttingDown = true;
};

export const getDrWorkerLastLockBusyBackoffMs = (): number => lastLockBusyBackoffMs;

const finalizeTerminalQueueFailure = async (
  item: BackupJobQueueItem,
  workerId: string,
  reason: string,
  preflight?: {
    jobPhase?: string;
    lockOwner?: string;
    heartbeatAt?: string;
    leaseExpiresAt?: string;
  }
): Promise<void> => {
  const { recordId } = item.payload;
  await getBackupJobQueue().failTerminal(recordId, workerId, reason);
  await connectDB();
  const record = await BackupRecord.findById(recordId).lean();
  if (record && record.status === "pending") {
    await BackupRecord.findByIdAndUpdate(recordId, {
      status: "failed",
      jobPhase: "failed",
      errorMessage: reason,
      jobCompletedAt: new Date(),
    });
  }
  workerTerminalFailureCount += 1;
  logDrWorkerFailure({
    recordId,
    queueEntryId: item.queueEntryId,
    workerId,
    attempt: item.attempts,
    jobPhase: preflight?.jobPhase,
    reason,
    retryable: false,
    lockOwner: preflight?.lockOwner,
    heartbeatAt: preflight?.heartbeatAt,
    leaseExpiresAt: preflight?.leaseExpiresAt,
  });
};

export const processNextBackupJob = async (
  workerId: string
): Promise<DrProcessNextBackupJobResult> => {
  if (workerProcessing || shuttingDown) return "empty";

  const item = await dequeueBackupJob(workerId);
  if (!item) return "empty";

  workerProcessing = true;
  currentJob = item;
  const startedAtMs = Date.now();

  try {
    const { executeDrBackupWorkerJob } = await import(
      "@/lib/disaster-recovery/worker/dr-worker"
    );
    await executeDrBackupWorkerJob(item, workerId);
    await getBackupJobQueue().ack(item.payload.recordId, workerId);
    lastLockBusyBackoffMs = 0;
    return "processed";
  } catch (error) {
    const { recordId } = item.payload;

    if (
      error instanceof DrWorkerOrphanQueueError ||
      error instanceof DrWorkerCorruptPayloadError ||
      error instanceof DrWorkerInvalidRecordStateError
    ) {
      await finalizeTerminalQueueFailure(item, workerId, error.message);
      lastLockBusyBackoffMs = 0;
      return "terminal_failed";
    }

    if (error instanceof DrWorkerLockBusyError) {
      if (error.inspection?.rejectionReason === "record_not_found") {
        await finalizeTerminalQueueFailure(item, workerId, "orphan_queue_entry:record_not_found", {
          jobPhase: error.inspection.jobPhase,
          lockOwner: error.inspection.workerId,
          heartbeatAt: error.inspection.heartbeatAt,
          leaseExpiresAt: error.inspection.leaseExpiresAt,
        });
        lastLockBusyBackoffMs = 0;
        return "terminal_failed";
      }

      const maxAttempts = resolveDrWorkerMaxLockAttempts();
      const backoffMs = computeDrWorkerLockBusyBackoffMs(item.attempts);
      lastLockBusyBackoffMs = Math.max(backoffMs, resolveWorkerPollMs());

      if (error.inspection?.lockIsStale) {
        const reclaimed = await reclaimStaleDrWorkerJobLock(recordId, workerId);
        if (reclaimed) {
          const lockBusyAttempts = await getBackupJobQueue().postponeProcessing(
            recordId,
            workerId,
            Math.min(backoffMs, 5_000),
            "stale_lock_reclaimed"
          );
          console.info("[DR] WORKER_LOCK_BUSY_RECLAIMED", {
            jobId: recordId,
            workerId,
            lockBusyAttempts,
          });
          return "lock_busy";
        }
      }

      const currentLockBusyAttempts = await getBackupJobQueue().getLockBusyAttempts(recordId);
      const nextLockBusyAttempts = currentLockBusyAttempts + 1;

      if (nextLockBusyAttempts >= maxAttempts) {
        const failureMessage = `DR worker lock busy after ${nextLockBusyAttempts} attempts: ${
          error.inspection?.rejectionReason ?? error.message
        }`;
        await getBackupJobQueue().fail(recordId, workerId, failureMessage, false);
        await connectDB();
        await BackupRecord.findByIdAndUpdate(recordId, {
          status: "failed",
          jobPhase: "failed",
          errorMessage: failureMessage,
        });
        workerTerminalFailureCount += 1;
        logDrWorkerFailure({
          recordId,
          queueEntryId: item.queueEntryId,
          workerId,
          attempt: item.attempts,
          jobPhase: error.inspection?.jobPhase,
          reason: failureMessage,
          retryable: false,
          elapsedMs: Date.now() - startedAtMs,
          lockOwner: error.inspection?.workerId,
          heartbeatAt: error.inspection?.heartbeatAt,
          leaseExpiresAt: error.inspection?.leaseExpiresAt,
        });
        lastLockBusyBackoffMs = 0;
        return "lock_failed";
      }

      const lockBusyAttempts = await getBackupJobQueue().postponeProcessing(
        recordId,
        workerId,
        backoffMs,
        error.inspection?.rejectionReason ?? error.message
      );

      console.warn("[DR] WORKER_LOCK_BUSY_POSTPONED", {
        jobId: recordId,
        workerId,
        lockBusyAttempts,
        backoffMs,
        inspection: error.inspection,
      });
      return "lock_busy";
    }

    const classification = classifyDrWorkerFailure(error);
    const message = error instanceof Error ? error.message : String(error);

    if (classification.retryable) {
      await getBackupJobQueue().fail(recordId, workerId, message, true);
      workerRetryCount += 1;
      logDrWorkerFailure({
        recordId,
        queueEntryId: item.queueEntryId,
        workerId,
        attempt: item.attempts,
        reason: classification.reason,
        retryable: true,
        elapsedMs: Date.now() - startedAtMs,
      });
      lastLockBusyBackoffMs = 0;
      return "retry_scheduled";
    }

    await getBackupJobQueue().fail(recordId, workerId, message, false);
    workerTerminalFailureCount += 1;
    logDrWorkerFailure({
      recordId,
      queueEntryId: item.queueEntryId,
      workerId,
      attempt: item.attempts,
      reason: classification.reason,
      retryable: false,
      elapsedMs: Date.now() - startedAtMs,
    });
    lastLockBusyBackoffMs = 0;
    return "terminal_failed";
  } finally {
    workerProcessing = false;
    currentJob = null;
  }
};

const releaseCurrentJobForShutdown = async (workerId: string): Promise<void> => {
  if (!currentJob) return;
  const { recordId } = currentJob.payload;
  await releaseDrWorkerJobLock(recordId, workerId);
  await getBackupJobQueue().postponeProcessing(
    recordId,
    workerId,
    resolveWorkerPollMs(),
    "worker_shutdown"
  );
  console.info("[DR] WORKER_SHUTDOWN_RECOVERY", { jobId: recordId, workerId });
};

const logWorkerHealth = async (workerId: string): Promise<void> => {
  const memory = readProcessMemorySnapshot();
  const counts = await getBackupJobQueue().getStatusCounts();
  logDrWorkerHealth({
    workerId,
    pid: process.pid,
    uptime: process.uptime(),
    rss: memory.rss,
    heapUsed: memory.heapUsed,
    heapTotal: memory.heapTotal,
    processing: workerProcessing,
    shuttingDown,
    queueSize: counts.queued + counts.processing,
    processingCount: counts.processing,
    completedCount: counts.completed,
    failedCount: counts.failed,
    retryCount: workerRetryCount,
  });
};

export const runDrPersistentWorker = async (): Promise<void> => {
  registerDrProcessDiagnostics();
  const connectDBModule = (await import("@/lib/mongodb")).default;
  await connectDBModule();

  const workerId = createDrWorkerId();
  const pollMs = resolveWorkerPollMs();
  let lastHealthLogAt = 0;
  workerStartedAt = Date.now();

  console.info("[DR] WORKER_STARTED", { workerId, pollMs });
  await runDrQueueIntegrityAuditAndRepair();
  await logDrQueueBacklog();

  const handleShutdown = (signal: string): void => {
    console.info("[DR] WORKER_STOPPING", { workerId, signal });
    shuttingDown = true;
    if (workerProcessing && currentJob) {
      void releaseCurrentJobForShutdown(workerId);
    }
  };

  process.on("SIGTERM", () => handleShutdown("SIGTERM"));
  process.on("SIGINT", () => handleShutdown("SIGINT"));

  while (!shuttingDown) {
    const backlog = await getBackupJobQueue().size();
    if (backlog === 0) {
      console.info("[DR] WORKER_IDLE", { workerId, pollMs });
      await sleep(pollMs);
      continue;
    }

    console.info("[DR] WORKER_WAKEUP", { workerId, backlog });
    const result = await processNextBackupJob(workerId);

    const now = Date.now();
    if (now - lastHealthLogAt >= HEALTH_LOG_MS) {
      lastHealthLogAt = now;
      await logWorkerHealth(workerId);
      await logDrQueueBacklog();
    }

    if (result === "lock_busy" || result === "retry_scheduled") {
      await sleep(lastLockBusyBackoffMs || pollMs);
      continue;
    }

    if (result === "empty") {
      await sleep(pollMs);
      continue;
    }

    await sleep(0);
  }

  const graceMs = resolveShutdownGraceMs();
  const shutdownDeadline = Date.now() + graceMs;
  while (workerProcessing && Date.now() < shutdownDeadline) {
    await sleep(250);
  }

  if (workerProcessing && currentJob) {
    await releaseCurrentJobForShutdown(workerId);
  }

  console.info("[DR] WORKER_STOPPED", {
    workerId,
    uptimeMs: Date.now() - workerStartedAt,
    terminalFailures: workerTerminalFailureCount,
    retries: workerRetryCount,
  });
};

export const resetDrPersistentWorkerState = (): void => {
  workerProcessing = false;
  shuttingDown = false;
  lastLockBusyBackoffMs = 0;
  currentJob = null;
  workerStartedAt = Date.now();
  workerRetryCount = 0;
  workerTerminalFailureCount = 0;
};
