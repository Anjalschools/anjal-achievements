import "server-only";

import { readProcessMemorySnapshot } from "@/lib/disaster-recovery/dr-memory-metrics";
import { registerDrProcessDiagnostics } from "@/lib/disaster-recovery/dr-process-diagnostics";
import {
  dequeueBackupJob,
  getBackupJobQueue,
  logDrQueueBacklog,
} from "@/lib/disaster-recovery/worker/dr-job-queue";
import { createDrWorkerId } from "@/lib/disaster-recovery/worker/dr-worker-lock";
import { recoverStaleBackupJobs } from "@/lib/disaster-recovery/worker/dr-worker-recovery";
import { DrWorkerLockBusyError } from "@/lib/disaster-recovery/worker/dr-worker-errors";
import type { BackupJobQueueItem } from "@/lib/disaster-recovery/worker/dr-job-queue-types";

const DEFAULT_POLL_MS = 2_000;
const HEALTH_LOG_MS = 30_000;

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

export const isDrBackupWorkerProcessing = (): boolean => workerProcessing;

export const requestDrPersistentWorkerShutdown = (): void => {
  shuttingDown = true;
};

export const processNextBackupJob = async (workerId: string): Promise<boolean> => {
  if (workerProcessing) return false;

  const item = await dequeueBackupJob(workerId);
  if (!item) return false;

  workerProcessing = true;
  try {
    const { executeDrBackupWorkerJob } = await import(
      "@/lib/disaster-recovery/worker/dr-worker"
    );
    await executeDrBackupWorkerJob(item, workerId);
    await getBackupJobQueue().ack(item.payload.recordId, workerId);
  } catch (error) {
    if (error instanceof DrWorkerLockBusyError) {
      await getBackupJobQueue().releaseProcessing(item.payload.recordId, workerId);
      return true;
    }
    const message = error instanceof Error ? error.message : String(error);
    await getBackupJobQueue().fail(item.payload.recordId, workerId, message);
  } finally {
    workerProcessing = false;
  }

  return true;
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
  const connectDB = (await import("@/lib/mongodb")).default;
  await connectDB();

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
    await processNextBackupJob(workerId);

    const now = Date.now();
    if (now - lastHealthLogAt >= HEALTH_LOG_MS) {
      lastHealthLogAt = now;
      logWorkerHealth(workerId);
      await logDrQueueBacklog();
    }

    await sleep(backlog > 0 ? 0 : pollMs);
  }
};

export const resetDrPersistentWorkerState = (): void => {
  workerProcessing = false;
  shuttingDown = false;
};
