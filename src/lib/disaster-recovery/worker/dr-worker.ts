import "server-only";

import connectDB from "@/lib/mongodb";
import BackupRecord from "@/models/BackupRecord";
import { logBackupAuditEvent } from "@/lib/backup/backup-audit";
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
import {
  startDrMemorySnapshotTimer,
  stopDrMemorySnapshotTimer,
} from "@/lib/disaster-recovery/dr-memory-snapshot-timer";
import { toDisasterRecoveryErrorPayload } from "@/lib/disaster-recovery/dr-backup-logging";
import {
  initDrJobStartup,
  logDrStartupMilestone,
  markDrWorkerStarted,
  printDrStartupReport,
  resetDrJobStartup,
} from "@/lib/disaster-recovery/dr-job-startup";
import { resolveDisasterRecoveryStorageProvider } from "@/lib/disaster-recovery/dr-storage-resolution";
import {
  initDrVerification,
  isDrVerificationActive,
  logDrException,
  logDrMilestone,
  printDrFinalReport,
  resetDrVerification,
} from "@/lib/disaster-recovery/dr-verification";
import {
  initDrLeakDetection,
  printDrLeakReport,
  resetDrLeakDetection,
} from "@/lib/disaster-recovery/dr-leak-detection";
import { getBackupJobQueue } from "@/lib/disaster-recovery/worker/dr-job-queue";
import type { BackupJobQueueItem } from "@/lib/disaster-recovery/worker/dr-job-queue-types";
import {
  acquireDrWorkerJobLock,
  releaseDrWorkerJobLock,
} from "@/lib/disaster-recovery/worker/dr-worker-lock";
import { DrWorkerLockBusyError } from "@/lib/disaster-recovery/worker/dr-worker-errors";
import {
  assertDrJobNotCancelled,
  DrJobCancelledError,
} from "@/lib/disaster-recovery/worker/dr-worker-heartbeat";
import {
  bindDrWorkerProgress,
  persistDrWorkerProgress,
  resetDrWorkerProgress,
  transitionDrWorkerJobPhase,
} from "@/lib/disaster-recovery/worker/dr-worker-progress";
import { isBackupExpired } from "@/lib/disaster-recovery/retention-policy";

export const executeDrBackupWorkerJob = async (
  item: BackupJobQueueItem,
  workerId: string
): Promise<void> => {
  const { recordId, input, audit, pruneExpiredOnComplete } = item.payload;

  console.info("[DR] WORKER_STARTED", { jobId: recordId, workerId, attempts: item.attempts });
  initDrJobStartup(recordId);
  markDrWorkerStarted();
  logDrStartupMilestone("QUEUE_JOB_DISPATCHED", { recordId, workerId });
  logDrStartupMilestone("BACKGROUND_JOB_STARTING", { recordId, workerId });

  if (!isDrVerificationActive()) {
    initDrVerification(recordId);
  }
  initDrLeakDetection();

  const lockAcquired = await acquireDrWorkerJobLock(recordId, workerId);
  if (!lockAcquired) {
    console.warn("[DR] WORKER_LOCK_BUSY", { jobId: recordId, workerId });
    throw new DrWorkerLockBusyError(recordId);
  }

  bindDrWorkerProgress(recordId);
  updateDrJobContext({ workerId, recordId });
  logDrStartupMilestone("BACKGROUND_JOB_STARTED", { recordId, workerId });
  await transitionDrWorkerJobPhase(recordId, "starting");

  resetDrJobContext({ recordId, phase: "manifest", startedAtMs: Date.now(), workerId });
  startDrHeartbeat(recordId);
  startDrMemorySnapshotTimer(recordId);

  const includeObjects = input.includeObjects !== false;
  const storageResolution = resolveDisasterRecoveryStorageProvider({
    requested: input.storageProvider,
    includeObjects,
    source: "dr-worker",
  });

  const drInput: CreateDisasterRecoveryBackupInput = {
    moduleId: input.moduleId,
    storageProvider: storageResolution.resolved,
    createdByUserId: input.createdByUserId,
    includeObjects: input.includeObjects,
    retentionTier: input.retentionTier,
    note: input.note,
    existingRecordId: recordId,
  };

  try {
    await assertDrJobNotCancelled(recordId);
    await persistDrWorkerProgress(recordId, { workerId });

    const result = await createDisasterRecoveryBackup(drInput);

    updateDrJobContext({ phase: "complete", processedObjects: result.objectCount || 0 });
    await transitionDrWorkerJobPhase(recordId, "completed");
    await persistDrWorkerProgress(recordId, {
      processedObjects: result.objectCount || 0,
      bytesExported: result.objectCount,
    });

    logDrMilestone("BACKUP_JOB_COMPLETED", {
      recordId,
      objectCount: result.objectCount,
      recoveryReadinessScore: result.recoveryReadinessScore,
    });
    console.info("[DR] WORKER_FINISHED", { jobId: recordId, workerId });

    if (audit?.actor) {
      await logBackupAuditEvent({
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
          workerId,
        },
        descriptionAr: "إنشاء نسخة كوارث كاملة (مهمة خلفية)",
      }).catch(() => undefined);
    }

    if (pruneExpiredOnComplete) {
      await connectDB();
      const expired = await BackupRecord.find({ status: "completed" }).lean();
      const metadataDeletes = expired.filter((row) =>
        isBackupExpired({ createdAt: row.createdAt, retentionTier: row.retentionTier })
      );
      for (const row of metadataDeletes) {
        await BackupRecord.findByIdAndDelete(row._id);
      }
    }
  } catch (error) {
    if (error instanceof DrJobCancelledError) {
      await connectDB();
      await BackupRecord.findByIdAndUpdate(recordId, {
        status: "failed",
        jobPhase: "cancelled",
        errorMessage: error.message,
        jobCompletedAt: new Date(),
      });
      await getBackupJobQueue().cancel(recordId);
      console.info("[DR] JOB_CANCELLED", { jobId: recordId, workerId });
      return;
    }

    const payloadError = toDisasterRecoveryErrorPayload(error);
    logDrException(payloadError.stage, error);
    console.error("[DR] WORKER_FAILED", {
      jobId: recordId,
      workerId,
      stage: payloadError.stage,
      message: payloadError.message,
      stack: payloadError.stack,
    });

    await connectDB();
    await BackupRecord.findByIdAndUpdate(recordId, {
      status: "failed",
      jobPhase: "failed",
      errorMessage: payloadError.message,
      jobCompletedAt: new Date(),
    });

    if (audit?.actor) {
      await logBackupAuditEvent({
        actor: audit.actor,
        actionType: "dr_backup_failed",
        metadata: {
          moduleId: input.moduleId,
          storageProvider: input.storageProvider,
          stage: payloadError.stage,
          message: payloadError.message,
          asyncJob: true,
          workerId,
        },
        outcome: "failure",
        descriptionAr: "فشل إنشاء نسخة كوارث كاملة (مهمة خلفية)",
      }).catch(() => undefined);
    }

    throw error;
  } finally {
    stopDrHeartbeat();
    stopDrMemorySnapshotTimer();
    await releaseDrWorkerJobLock(recordId, workerId);
    resetDrWorkerProgress();

    const ctx = getDrJobContext();
    console.log("[DR] HEARTBEAT", {
      phase: ctx.phase,
      processedObjects: ctx.processedObjects,
      totalObjects: ctx.totalObjects,
      archivePointer: ctx.archivePointer,
      recordId: ctx.recordId,
      final: true,
    });
    printDrStartupReport();
    printDrFinalReport();
    await printDrLeakReport();
    resetDrLeakDetection();
    resetDrVerification();
    resetDrJobStartup();
  }
};
