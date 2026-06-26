import "server-only";

import connectDB from "@/lib/mongodb";
import BackupRecord from "@/models/BackupRecord";
import DrBackupQueueEntry from "@/models/DrBackupQueueEntry";
import {
  enqueueBackupJob,
  getBackupJobQueue,
  type BackupJobQueuePayload,
} from "@/lib/disaster-recovery/worker/dr-job-queue";
import { validateDrQueuePayload } from "@/lib/disaster-recovery/worker/dr-queue-payload-validation";
import {
  createEmptyDrQueueIntegrityAudit,
  logDrQueueIntegrityAudit,
  type DrQueueIntegrityAudit,
} from "@/lib/disaster-recovery/worker/dr-worker-diagnostics";
import { recoverStaleBackupJobs } from "@/lib/disaster-recovery/worker/dr-worker-recovery";
import type { StartDisasterRecoveryJobInput } from "@/lib/disaster-recovery/dr-backup-job-types";

const DEFAULT_QUEUE_CLEANUP_DAYS = 30;

export const resolveDrQueueCleanupDays = (): number => {
  const raw = process.env.DR_QUEUE_CLEANUP_DAYS;
  if (!raw) return DEFAULT_QUEUE_CLEANUP_DAYS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_QUEUE_CLEANUP_DAYS;
};

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

const normalizeInvalidBackupRecord = async (
  recordId: string,
  row: { status: string; jobPhase?: string | null }
): Promise<boolean> => {
  if (row.status === "pending" && row.jobPhase === "failed") {
    await BackupRecord.findByIdAndUpdate(recordId, {
      status: "failed",
      jobCompletedAt: new Date(),
    });
    return true;
  }

  if (row.status === "completed" && row.jobPhase && row.jobPhase !== "completed") {
    await BackupRecord.findByIdAndUpdate(recordId, { jobPhase: "completed" });
    return true;
  }

  return false;
};

export const cleanupDrTerminalQueueEntries = async (): Promise<number> => {
  await connectDB();
  const cutoff = new Date(Date.now() - resolveDrQueueCleanupDays() * 24 * 60 * 60 * 1000);
  const result = await DrBackupQueueEntry.deleteMany({
    status: { $in: ["completed", "failed", "cancelled"] },
    updatedAt: { $lt: cutoff },
  });
  if (result.deletedCount > 0) {
    console.info("[DR] QUEUE_CLEANUP", { deleted: result.deletedCount, cutoff });
  }
  return result.deletedCount;
};

export const runDrQueueIntegrityAuditAndRepair = async (): Promise<DrQueueIntegrityAudit> => {
  await connectDB();
  const audit = createEmptyDrQueueIntegrityAudit();
  const queue = getBackupJobQueue();

  const [queued, processing, completed, failed, cancelled] = await Promise.all([
    DrBackupQueueEntry.countDocuments({ status: "queued" }),
    DrBackupQueueEntry.countDocuments({ status: "processing" }),
    DrBackupQueueEntry.countDocuments({ status: "completed" }),
    DrBackupQueueEntry.countDocuments({ status: "failed" }),
    DrBackupQueueEntry.countDocuments({ status: "cancelled" }),
  ]);

  audit.queued = queued;
  audit.processing = processing;
  audit.completed = completed;
  audit.failed = failed;
  audit.cancelled = cancelled;

  const activeEntries = await DrBackupQueueEntry.find({
    status: { $in: ["queued", "processing"] },
  })
    .select("_id recordId status payload workerId")
    .lean();

  const seenRecordIds = new Set<string>();
  for (const entry of activeEntries) {
    const recordId = String(entry.recordId);
    if (seenRecordIds.has(recordId)) {
      audit.duplicate += 1;
      await DrBackupQueueEntry.findByIdAndUpdate(entry._id, {
        status: "failed",
        failedAt: new Date(),
        lastError: "duplicate_queue_entry",
      });
      audit.repaired += 1;
      continue;
    }
    seenRecordIds.add(recordId);

    const payloadValidation = validateDrQueuePayload(
      entry.payload as BackupJobQueuePayload | undefined
    );
    if (!payloadValidation.valid) {
      audit.corrupted += 1;
      await DrBackupQueueEntry.findByIdAndUpdate(entry._id, {
        status: "failed",
        failedAt: new Date(),
        lastError: `corrupted_payload:${payloadValidation.reason}`,
        workerId: undefined,
        dequeuedAt: undefined,
      });
      audit.repaired += 1;
      continue;
    }

    const record = await BackupRecord.findById(recordId)
      .select("status jobPhase backupModule storageProvider createdBy includesObjectStorage retentionTier note")
      .lean();

    if (!record) {
      audit.orphan += 1;
      await DrBackupQueueEntry.findByIdAndUpdate(entry._id, {
        status: "failed",
        failedAt: new Date(),
        lastError: "orphan_queue_entry:backup_record_missing",
        workerId: undefined,
        dequeuedAt: undefined,
      });
      audit.repaired += 1;
      continue;
    }

    if (await normalizeInvalidBackupRecord(recordId, record)) {
      audit.repaired += 1;
    }

    if (record.status === "completed" || record.status === "failed") {
      await DrBackupQueueEntry.findByIdAndUpdate(entry._id, {
        status: record.status === "completed" ? "completed" : "failed",
        ackedAt: record.status === "completed" ? new Date() : undefined,
        failedAt: record.status === "failed" ? new Date() : undefined,
        lastError: record.status === "failed" ? "record_already_failed" : undefined,
        workerId: undefined,
        dequeuedAt: undefined,
      });
      audit.repaired += 1;
      continue;
    }
  }

  const pendingWithoutQueue = await BackupRecord.find({
    status: "pending",
    jobPhase: { $in: ["queued", "starting", null] },
  })
    .select("_id backupModule storageProvider createdBy includesObjectStorage retentionTier note")
    .lean();

  for (const row of pendingWithoutQueue) {
    const recordId = String(row._id);
    if (await queue.has(recordId)) continue;
    await enqueueBackupJob(buildPayloadFromRecord(row));
    audit.recovered += 1;
    audit.repaired += 1;
    console.info("[DR] QUEUE_REPAIRED", { jobId: recordId, action: "enqueue_missing_queue_entry" });
  }

  const reclaimed = await recoverStaleBackupJobs();
  audit.reclaimed = reclaimed.length;
  audit.recovered += reclaimed.length;
  audit.repaired += reclaimed.length;

  const cancelledEntries = await DrBackupQueueEntry.find({ status: "cancelled" })
    .select("recordId")
    .lean();
  for (const entry of cancelledEntries) {
    const recordId = String(entry.recordId);
    const record = await BackupRecord.findById(recordId).select("status").lean();
    if (record?.status === "pending") {
      await BackupRecord.findByIdAndUpdate(recordId, {
        status: "failed",
        jobPhase: "cancelled",
        errorMessage: "queue_entry_cancelled",
        jobCompletedAt: new Date(),
      });
      audit.repaired += 1;
    }
  }

  await cleanupDrTerminalQueueEntries();
  logDrQueueIntegrityAudit(audit);
  return audit;
};
