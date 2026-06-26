import "server-only";

import connectDB from "@/lib/mongodb";
import BackupRecord from "@/models/BackupRecord";
import DrBackupQueueEntry from "@/models/DrBackupQueueEntry";
import type { StartDisasterRecoveryJobInput } from "@/lib/disaster-recovery/dr-backup-job-types";
import {
  enqueueBackupJob,
  getBackupJobQueue,
  type BackupJobQueuePayload,
} from "@/lib/disaster-recovery/worker/dr-job-queue";
import {
  resolveDrWorkerLeaseMs,
  resolveDrWorkerHeartbeatStaleMs,
} from "@/lib/disaster-recovery/worker/dr-worker-lock";

export { resolveDrWorkerHeartbeatStaleMs };

const RECOVERABLE_PHASES = [
  "queued",
  "starting",
  "started",
  "manifest",
  "inventory",
  "exporting",
  "object-export",
  "uploading",
  "zip",
  "verifying",
  "backup-record",
] as const;

const buildPayloadFromRecord = (row: {
  _id: unknown;
  backupModule: string;
  storageProvider: string;
  createdBy: unknown;
  includesObjectStorage?: boolean;
  retentionTier?: string;
  note?: string;
}): BackupJobQueuePayload => {
  const recordId = String(row._id);
  const input: StartDisasterRecoveryJobInput = {
    moduleId: row.backupModule as StartDisasterRecoveryJobInput["moduleId"],
    storageProvider: row.storageProvider as StartDisasterRecoveryJobInput["storageProvider"],
    createdByUserId: String(row.createdBy),
    includeObjects: row.includesObjectStorage !== false,
    retentionTier: (row.retentionTier as StartDisasterRecoveryJobInput["retentionTier"]) || "daily",
    note: row.note,
  };

  return {
    recordId,
    input,
    source: "recovery",
    pruneExpiredOnComplete: row.note === "scheduled-dr-backup",
  };
};

export const recoverStaleBackupJobs = async (): Promise<string[]> => {
  const now = new Date();
  const heartbeatCutoff = new Date(Date.now() - resolveDrWorkerHeartbeatStaleMs());
  const leaseCutoff = new Date(Date.now() - resolveDrWorkerLeaseMs());
  await connectDB();

  const recovered = new Set<string>();
  const queue = getBackupJobQueue();

  const staleRecords = await BackupRecord.find({
    status: "pending",
    jobPhase: { $in: [...RECOVERABLE_PHASES] },
    $or: [
      { heartbeatAt: { $lt: heartbeatCutoff } },
      { heartbeatAt: { $exists: false } },
      { leaseExpiresAt: { $lt: now } },
      { leaseExpiresAt: { $exists: false }, workerId: { $exists: true, $ne: null } },
    ],
  })
    .select(
      "_id backupModule storageProvider createdBy includesObjectStorage retentionTier note workerId leaseExpiresAt"
    )
    .lean();

  for (const row of staleRecords) {
    const recordId = String(row._id);
    if (row.leaseExpiresAt && row.leaseExpiresAt < now) {
      console.warn("[DR] LEASE_EXPIRED", {
        jobId: recordId,
        workerId: row.workerId,
        leaseExpiresAt: row.leaseExpiresAt,
      });
    }

    await BackupRecord.findByIdAndUpdate(recordId, {
      $unset: { workerId: "", lockedAt: "", leaseExpiresAt: "" },
      jobPhase: "queued",
    });

    await DrBackupQueueEntry.findOneAndUpdate(
      { recordId, status: "processing" },
      { status: "queued", workerId: undefined, dequeuedAt: undefined }
    );

    if (!(await queue.has(recordId))) {
      await enqueueBackupJob(buildPayloadFromRecord(row));
    } else {
      await queue.retry(recordId);
    }

    recovered.add(recordId);
    console.info("[DR] JOB_RECLAIMED", { jobId: recordId, previousWorkerId: row.workerId });
    console.info("[DR] JOB_RESUMED", { jobId: recordId });
    console.info("[DR] JOB_RECOVERED", { jobId: recordId, previousWorkerId: row.workerId });
  }

  const staleQueueEntries = await DrBackupQueueEntry.find({
    status: "processing",
    $or: [{ dequeuedAt: { $lt: leaseCutoff } }, { dequeuedAt: { $exists: false } }],
  })
    .select("recordId workerId dequeuedAt")
    .lean();

  for (const entry of staleQueueEntries) {
    const recordId = String(entry.recordId);
    await DrBackupQueueEntry.findOneAndUpdate(
      { recordId, status: "processing" },
      { status: "queued", workerId: undefined, dequeuedAt: undefined }
    );
    if (!(await queue.has(recordId))) {
      const row = await BackupRecord.findById(recordId).lean();
      if (row && row.status === "pending") {
        await enqueueBackupJob(buildPayloadFromRecord(row));
      }
    }
    recovered.add(recordId);
    console.info("[DR] QUEUE_RECOVERED", { jobId: recordId, workerId: entry.workerId });
  }

  if (recovered.size > 0) {
    const backlog = await queue.size();
    console.info("[DR] QUEUE_RECOVERED", { count: recovered.size, backlog });
  }

  return Array.from(recovered);
};
