import "server-only";

import { getBackupJobQueue } from "@/lib/disaster-recovery/worker/dr-job-queue";

export const logDrJobNotFound = async (
  jobId: string,
  extra?: Record<string, unknown>
): Promise<void> => {
  const queueJobs = await getBackupJobQueue().list().catch(() => []);
  console.warn("[DR] JOB_NOT_FOUND", {
    jobId,
    pid: process.pid,
    uptime: process.uptime(),
    queueJobs,
    ...extra,
  });
};

export const requestDrJobCancellation = async (recordId: string): Promise<boolean> => {
  const connectDB = (await import("@/lib/mongodb")).default;
  const BackupRecord = (await import("@/models/BackupRecord")).default;

  await connectDB();
  const recordUpdated = await BackupRecord.findOneAndUpdate(
    { _id: recordId, status: "pending" },
    { cancelRequested: true },
    { new: true }
  );
  const queueCancelled = await getBackupJobQueue().cancel(recordId);
  return Boolean(recordUpdated) || queueCancelled;
};
