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
import {
  computeDrWorkerLockBusyBackoffMs,
  createDrWorkerId,
  reclaimStaleDrWorkerJobLock,
  resolveDrWorkerMaxLockAttempts,
} from "@/lib/disaster-recovery/worker/dr-worker-lock";
import { recoverStaleBackupJobs } from "@/lib/disaster-recovery/worker/dr-worker-recovery";
import { DrWorkerLockBusyError } from "@/lib/disaster-recovery/worker/dr-worker-errors";

const DEFAULT_POLL_MS = 2_000;
const HEALTH_LOG_MS = 30_000;

export type DrProcessNextBackupJobResult = "empty" | "processed" | "lock_busy" | "lock_failed";

const resolveWorkerPollMs = (): number => {
  const raw = process.env.DR_WORKER_POLL_MS;
  if (!raw) return DEFAULT_POLL_MS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_POLL_MS;
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

let workerProcessing = false;
let shuttingDown = false;
let lastLockBusyBackoffMs = 0;

export const isDrBackupWorkerProcessing = (): boolean => workerProcessing;

export const requestDrPersistentWorkerShutdown = (): void => {
  shuttingDown = true;
};

export const getDrWorkerLastLockBusyBackoffMs = (): number => lastLockBusyBackoffMs;

export const processNextBackupJob = async (
  workerId: string
): Promise<DrProcessNextBackupJobResult> => {
  if (workerProcessing) return "empty";

  const item = await dequeueBackupJob(workerId);
  if (!item) return "empty";

  workerProcessing = true;
  try {
    const { executeDrBackupWorkerJob } = await import(
      "@/lib/disaster-recovery/worker/dr-worker"
    );
    await executeDrBackupWorkerJob(item, workerId);
    await getBackupJobQueue().ack(item.payload.recordId, workerId);
    lastLockBusyBackoffMs = 0;
    return "processed";
  } catch (error) {
    if (error instanceof DrWorkerLockBusyError) {
      const { recordId } = item.payload;
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
        console.error("[DR] WORKER_LOCK_FAILED", {
          jobId: recordId,
          workerId,
          lockBusyAttempts: nextLockBusyAttempts,
          inspection: error.inspection,
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

    const message = error instanceof Error ? error.message : String(error);
    await getBackupJobQueue().fail(item.payload.recordId, workerId, message);
    lastLockBusyBackoffMs = 0;
    return "processed";
  } finally {
    workerProcessing = false;
  }
};

const logWorkerHealth = (workerId: string): void => {
  const memory = readProcessMemorySnapshot();
  console.info("[DR] WORKER_HEALTH", {
    workerId,
    pid: process.pid,
    uptime: process.uptime(),
    rss: memory.rss,
    heapUsed: memory.heapUsed,
    heapTotal: memory.heapTotal,
    processing: workerProcessing,
    shuttingDown,
  });
};

export const runDrPersistentWorker = async (): Promise<void> => {
  registerDrProcessDiagnostics();
  const connectDBModule = (await import("@/lib/mongodb")).default;
  await connectDBModule();

  const workerId = createDrWorkerId();
  const pollMs = resolveWorkerPollMs();
  let lastHealthLogAt = 0;

  console.info("[DR] WORKER_STARTED", { workerId, pollMs });
  await recoverStaleBackupJobs();
  await logDrQueueBacklog();

  const handleShutdown = (signal: string): void => {
    console.info("[DR] WORKER_STOPPED", { workerId, signal });
    shuttingDown = true;
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
      logWorkerHealth(workerId);
      await logDrQueueBacklog();
    }

    if (result === "lock_busy") {
      await sleep(lastLockBusyBackoffMs || pollMs);
      continue;
    }

    if (result === "empty") {
      await sleep(pollMs);
      continue;
    }

    await sleep(0);
  }
};

export const resetDrPersistentWorkerState = (): void => {
  workerProcessing = false;
  shuttingDown = false;
  lastLockBusyBackoffMs = 0;
};
