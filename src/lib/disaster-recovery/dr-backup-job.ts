import "server-only";
import connectDB from "@/lib/mongodb";
import BackupRecord from "@/models/BackupRecord";
import { type BackupModuleId, type BackupStorageProviderId } from "@/lib/backup/backup-constants";
import { logBackupAuditEvent } from "@/lib/backup/backup-audit";
import type { AuditActor } from "@/lib/audit-log-service";
import type { NextRequest } from "next/server";
import {
  createDisasterRecoveryBackup,
  type CreateDisasterRecoveryBackupInput,
} from "@/lib/disaster-recovery/dr-backup-service";
import {
  getDrJobContext,
  resetDrJobContext,
  updateDrJobContext,
} from "@/lib/disaster-recovery/dr-job-context";
import { startDrHeartbeat, stopDrHeartbeat } from "@/lib/disaster-recovery/dr-heartbeat";
import { registerDrProcessDiagnostics } from "@/lib/disaster-recovery/dr-process-diagnostics";
import { toDisasterRecoveryErrorPayload } from "@/lib/disaster-recovery/dr-backup-logging";
import type { RetentionTier } from "@/lib/disaster-recovery/retention-policy";

registerDrProcessDiagnostics();

const buildDrFileName = (moduleId: BackupModuleId): string => {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `anjal-dr-backup-${moduleId}-${stamp}.zip`;
};

export type StartDisasterRecoveryJobInput = {
  moduleId: BackupModuleId;
  storageProvider: BackupStorageProviderId;
  createdByUserId: string;
  includeObjects?: boolean;
  retentionTier?: RetentionTier;
  note?: string;
};

export type DisasterRecoveryJobAccepted = {
  recordId: string;
  status: "pending";
  statusUrl: string;
  fileName: string;
};

type JobAuditContext = {
  request: NextRequest;
  actor: AuditActor;
};

export const startDisasterRecoveryBackupJob = async (
  input: StartDisasterRecoveryJobInput,
  audit?: JobAuditContext
): Promise<DisasterRecoveryJobAccepted> => {
  console.log("[DR-JOB] startDisasterRecoveryBackupJob");
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
    jobStartedAt: new Date(),
  });

  const recordId = String(record._id);
  console.log("[DR-JOB] pending record created", { recordId, fileName });

  void executeDisasterRecoveryBackupJob(recordId, input, audit).catch((error) => {
    console.error("[DR-JOB] background execution failed to start", {
      recordId,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  });

  return {
    recordId,
    status: "pending",
    statusUrl: `/api/admin/backup/${recordId}`,
    fileName,
  };
};

export const executeDisasterRecoveryBackupJob = async (
  recordId: string,
  input: StartDisasterRecoveryJobInput,
  audit?: JobAuditContext
): Promise<void> => {
  console.log("[DR-JOB] executeDisasterRecoveryBackupJob", { recordId });
  resetDrJobContext({ recordId, phase: "queued" });
  startDrHeartbeat(recordId);

  const drInput: CreateDisasterRecoveryBackupInput = {
    moduleId: input.moduleId,
    storageProvider: input.storageProvider,
    createdByUserId: input.createdByUserId,
    includeObjects: input.includeObjects,
    retentionTier: input.retentionTier,
    note: input.note,
    existingRecordId: recordId,
  };

  try {
    const result = await createDisasterRecoveryBackup(drInput);
    updateDrJobContext({ phase: "complete", processedObjects: result.objectCount || 0 });
    console.log("[DR-JOB] completed", { recordId, objectCount: result.objectCount });

    if (audit) {
      await logBackupAuditEvent({
        request: audit.request,
        actor: audit.actor,
        actionType: "dr_backup_created",
        entityId: recordId,
        metadata: {
          moduleId: input.moduleId,
          storageProvider: input.storageProvider,
          objectCount: result.objectCount,
          recoveryReadinessScore: result.recoveryReadinessScore,
          retentionTier: input.retentionTier || "daily",
          asyncJob: true,
        },
        descriptionAr: "إنشاء نسخة كوارث كاملة (مهمة خلفية)",
      }).catch(() => undefined);
    }
  } catch (error) {
    const payload = toDisasterRecoveryErrorPayload(error);
    console.error("[DR-JOB] failed", {
      recordId,
      stage: payload.stage,
      message: payload.message,
      stack: payload.stack,
    });

    await connectDB();
    await BackupRecord.findByIdAndUpdate(recordId, {
      status: "failed",
      jobPhase: "failed",
      errorMessage: payload.message,
      jobCompletedAt: new Date(),
    });

    if (audit) {
      await logBackupAuditEvent({
        request: audit.request,
        actor: audit.actor,
        actionType: "dr_backup_failed",
        metadata: {
          moduleId: input.moduleId,
          storageProvider: input.storageProvider,
          stage: payload.stage,
          message: payload.message,
          asyncJob: true,
        },
        outcome: "failure",
        descriptionAr: "فشل إنشاء نسخة كوارث كاملة (مهمة خلفية)",
      }).catch(() => undefined);
    }
  } finally {
    stopDrHeartbeat();
    const ctx = getDrJobContext();
    console.log("[DR] HEARTBEAT", {
      phase: ctx.phase,
      processedObjects: ctx.processedObjects,
      totalObjects: ctx.totalObjects,
      archivePointer: ctx.archivePointer,
      recordId: ctx.recordId,
      final: true,
    });
  }
};
