import "server-only";

import type {
  BackupJobQueue,
  BackupJobQueuePayload,
} from "@/lib/disaster-recovery/worker/dr-job-queue-types";

export type {
  BackupJobQueue,
  BackupJobQueueAuditContext,
  BackupJobQueueItem,
  BackupJobQueuePayload,
} from "@/lib/disaster-recovery/worker/dr-job-queue-types";

let activeQueue: BackupJobQueue | null = null;

const createDefaultBackupJobQueue = (): BackupJobQueue => {
  const { createMongoBackupJobQueue } =
    require("@/lib/disaster-recovery/worker/dr-mongo-job-queue") as typeof import("@/lib/disaster-recovery/worker/dr-mongo-job-queue");
  return createMongoBackupJobQueue();
};

export const getBackupJobQueue = (): BackupJobQueue => {
  if (!activeQueue) {
    activeQueue = createDefaultBackupJobQueue();
  }
  return activeQueue;
};

export const setBackupJobQueue = (queue: BackupJobQueue): void => {
  activeQueue = queue;
};

export const resetBackupJobQueue = (): void => {
  activeQueue = null;
};

export const enqueueBackupJob = async (payload: BackupJobQueuePayload): Promise<void> => {
  await getBackupJobQueue().enqueue(payload);
};

export const dequeueBackupJob = async (workerId: string) =>
  getBackupJobQueue().dequeue(workerId);

export const logDrQueueBacklog = async (): Promise<void> => {
  const backlog = await getBackupJobQueue().size();
  const jobs = await getBackupJobQueue().list();
  console.info("[DR] QUEUE_BACKLOG", { backlog, jobs });
};
