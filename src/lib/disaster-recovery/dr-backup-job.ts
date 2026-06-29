import "server-only";

/**
 * DR production job enqueue (DR.BACKUP.V2).
 * Creates a BackupRecord and enqueues work for executeProductionV2Backup in dr-worker.
 */
import connectDB from "@/lib/mongodb";
import BackupRecord from "@/models/BackupRecord";
import { type BackupModuleId } from "@/lib/backup/backup-constants";
import type { AuditActor } from "@/lib/audit-log-service";
import type { NextRequest } from "next/server";
import {
  initDrJobStartup,
  logDrStartupMilestone,
  markDrJobQueued,
} from "@/lib/disaster-recovery/dr-job-startup";
import { logDrMilestone } from "@/lib/disaster-recovery/dr-verification";
import {
  enqueueBackupJob,
  type BackupJobQueuePayload,
} from "@/lib/disaster-recovery/worker/dr-job-queue";
import type {
  DisasterRecoveryJobAccepted,
  StartDisasterRecoveryJobInput,
} from "@/lib/disaster-recovery/dr-backup-job-types";

export type { DisasterRecoveryJobAccepted, StartDisasterRecoveryJobInput };

const buildDrFileName = (moduleId: BackupModuleId): string => {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `anjal-dr-backup-${moduleId}-${stamp}.zip`;
};

type JobAuditContext = {
  request: NextRequest;
  actor: AuditActor;
};

export const startDisasterRecoveryBackupJob = async (
  input: StartDisasterRecoveryJobInput,
  audit?: JobAuditContext,
  options?: { source?: BackupJobQueuePayload["source"]; pruneExpiredOnComplete?: boolean }
): Promise<DisasterRecoveryJobAccepted> => {
  console.log("[DR-JOB] startDisasterRecoveryBackupJob engine=disaster-recovery-v2");
  markDrJobQueued();
  await connectDB();

  const includeObjects = input.includeObjects !== false;
  const fileName = buildDrFileName(input.moduleId);

  const record = await BackupRecord.create({
    createdBy: input.createdByUserId,
    backupType: input.moduleId,
    backupModule: input.moduleId,
    backupKind: includeObjects ? "disaster_recovery" : "database",
    status: "pending",
    storageProvider: input.storageProvider,
    fileName,
    note: input.note,
    includesObjectStorage: includeObjects,
    retentionTier: input.retentionTier || "daily",
    validationStatus: "pending",
    jobPhase: "queued",
    processedObjects: 0,
    archivePointer: 0,
    totalObjects: 0,
    jobStartedAt: new Date(),
    heartbeatAt: new Date(),
    cancelRequested: false,
  });

  const recordId = String(record._id);
  initDrJobStartup(recordId);
  logDrStartupMilestone("QUEUE_JOB_CREATED", { recordId });
  logDrStartupMilestone("BACKUP_RECORD_CREATED", { recordId, fileName });
  logDrMilestone("BACKUP_RECORD_CREATED", { recordId });
  console.log("[DR-JOB] pending record created", { recordId, fileName });

  await enqueueBackupJob({
    recordId,
    input,
    audit: audit
      ? {
          actor: {
            id: audit.actor.id,
            name: audit.actor.name,
            email: audit.actor.email,
            role: audit.actor.role,
          },
        }
      : undefined,
    source: options?.source ?? "api",
    pruneExpiredOnComplete: options?.pruneExpiredOnComplete,
  });
  logDrStartupMilestone("QUEUE_JOB_SCHEDULED", { recordId });

  return {
    recordId,
    status: "pending",
    statusUrl: `/api/admin/backup/${recordId}`,
    fileName,
  };
};
