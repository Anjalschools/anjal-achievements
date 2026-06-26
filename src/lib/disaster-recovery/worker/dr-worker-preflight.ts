import "server-only";

import connectDB from "@/lib/mongodb";
import BackupRecord from "@/models/BackupRecord";
import {
  DrWorkerCorruptPayloadError,
  DrWorkerInvalidRecordStateError,
  DrWorkerOrphanQueueError,
} from "@/lib/disaster-recovery/worker/dr-worker-errors";
import { validateDrQueuePayload } from "@/lib/disaster-recovery/worker/dr-queue-payload-validation";
import type { BackupJobQueueItem } from "@/lib/disaster-recovery/worker/dr-job-queue-types";

const TERMINAL_RECORD_STATUSES = new Set(["completed", "failed", "cancelled"]);
const ACTIVE_JOB_PHASES = new Set([
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
]);

export type DrWorkerPreflightResult = {
  jobPhase?: string;
  status?: string;
  lockOwner?: string;
  heartbeatAt?: string;
  leaseExpiresAt?: string;
};

export const assertDrWorkerJobPreflight = async (
  item: BackupJobQueueItem
): Promise<DrWorkerPreflightResult> => {
  const { recordId } = item.payload;
  const payloadValidation = validateDrQueuePayload(item.payload);
  if (!payloadValidation.valid) {
    throw new DrWorkerCorruptPayloadError(recordId, payloadValidation.reason);
  }

  await connectDB();
  const record = await BackupRecord.findById(recordId)
    .select("status jobPhase workerId heartbeatAt leaseExpiresAt")
    .lean();

  if (!record) {
    throw new DrWorkerOrphanQueueError(recordId, "backup_record_missing");
  }

  const status = String(record.status);
  const jobPhase = record.jobPhase ? String(record.jobPhase) : undefined;

  if (TERMINAL_RECORD_STATUSES.has(status)) {
    throw new DrWorkerInvalidRecordStateError(
      recordId,
      `record_terminal_status:${status}`
    );
  }

  if (status === "pending" && jobPhase === "failed") {
    throw new DrWorkerInvalidRecordStateError(recordId, "pending_with_failed_phase");
  }

  if (status === "completed" && jobPhase && ACTIVE_JOB_PHASES.has(jobPhase)) {
    throw new DrWorkerInvalidRecordStateError(recordId, "completed_with_active_phase");
  }

  return {
    jobPhase,
    status,
    lockOwner: record.workerId ? String(record.workerId) : undefined,
    heartbeatAt: record.heartbeatAt ? new Date(record.heartbeatAt).toISOString() : undefined,
    leaseExpiresAt: record.leaseExpiresAt ? new Date(record.leaseExpiresAt).toISOString() : undefined,
  };
};
