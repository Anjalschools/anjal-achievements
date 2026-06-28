import "server-only";

import connectDB from "@/lib/mongodb";
import BackupRecord from "@/models/BackupRecord";
import { logBackupAuditEvent } from "@/lib/backup/backup-audit";
import {
  executeProductionV2Backup,
  ProductionV2BackupError,
} from "@/lib/disaster-recovery-v2/production/execute-production-v2-backup";
import { touchV2ProductionWorkerHeartbeat } from "@/lib/disaster-recovery-v2/production/v2-production-worker-heartbeat";
import { V2_PRODUCTION_JOB_PHASES } from "@/lib/disaster-recovery-v2/production/v2-production-stage-mapping";
import { persistV2ProductionProgress } from "@/lib/disaster-recovery-v2/production/v2-production-progress";
import { getBackupJobQueue } from "@/lib/disaster-recovery/worker/dr-job-queue";
import type { BackupJobQueueItem } from "@/lib/disaster-recovery/worker/dr-job-queue-types";
import {
  acquireDrWorkerJobLock,
  inspectDrWorkerJobLock,
  releaseDrWorkerJobLock,
  touchDrWorkerJobLock,
} from "@/lib/disaster-recovery/worker/dr-worker-lock";
import { DrWorkerLockBusyError } from "@/lib/disaster-recovery/worker/dr-worker-errors";
import {
  assertDrJobNotCancelled,
  DrJobCancelledError,
} from "@/lib/disaster-recovery/worker/dr-worker-heartbeat";
import { isBackupExpired } from "@/lib/disaster-recovery/retention-policy";
import { assertDrWorkerJobPreflight } from "@/lib/disaster-recovery/worker/dr-worker-preflight";

const HEARTBEAT_MS = 30_000;

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

const startV2WorkerHeartbeat = (input: { recordId: string; workerId: string }): void => {
  stopV2WorkerHeartbeat();

  const emitHeartbeat = (): void => {
    void touchDrWorkerJobLock(input.recordId, input.workerId).catch(() => undefined);
    void touchV2ProductionWorkerHeartbeat(input).catch(() => undefined);
  };

  emitHeartbeat();
  heartbeatTimer = setInterval(emitHeartbeat, HEARTBEAT_MS);
};

const stopV2WorkerHeartbeat = (): void => {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
};

export const executeDrBackupWorkerJob = async (
  item: BackupJobQueueItem,
  workerId: string
): Promise<void> => {
  const { recordId, input, audit, pruneExpiredOnComplete } = item.payload;

  const preflight = await assertDrWorkerJobPreflight(item);

  await connectDB();
  const pendingRecord = await BackupRecord.findById(recordId).select("fileName").lean();
  const fileName = pendingRecord?.fileName;
  if (!fileName) {
    throw new Error(`BACKUP_RECORD_FILENAME_MISSING:${recordId}`);
  }

  const lockAcquired = await acquireDrWorkerJobLock(recordId, workerId);
  if (!lockAcquired) {
    const inspection = await inspectDrWorkerJobLock(recordId, workerId);
    throw new DrWorkerLockBusyError(recordId, inspection ?? undefined);
  }

  startV2WorkerHeartbeat({ recordId, workerId });
  await persistV2ProductionProgress(recordId, {
    jobPhase: V2_PRODUCTION_JOB_PHASES.STARTING,
    workerId,
  });

  try {
    await assertDrJobNotCancelled(recordId);

    const result = await executeProductionV2Backup({
      recordId,
      fileName,
      moduleId: input.moduleId,
      storageProvider: input.storageProvider,
      createdByUserId: input.createdByUserId,
      includeObjects: input.includeObjects,
      retentionTier: input.retentionTier,
      note: input.note,
      workerId,
      assertNotCancelled: () => assertDrJobNotCancelled(recordId),
    });

    if (audit?.actor) {
      await logBackupAuditEvent({
        actor: audit.actor,
        actionType: "dr_backup_created",
        entityId: recordId,
        metadata: {
          moduleId: input.moduleId,
          storageProvider: result.storageProvider,
          objectCount: result.objectCount,
          recoveryReadinessScore: result.recoveryReadinessScore,
          retentionTier: input.retentionTier || "daily",
          asyncJob: true,
          workerId,
          engine: "disaster-recovery-v2",
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
        jobPhase: V2_PRODUCTION_JOB_PHASES.CANCELLED,
        errorMessage: error.message,
        jobCompletedAt: new Date(),
      });
      await getBackupJobQueue().cancel(recordId);
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    const stage = error instanceof ProductionV2BackupError ? error.stage : "unknown";

    await connectDB();
    await BackupRecord.findByIdAndUpdate(recordId, {
      status: "failed",
      jobPhase: V2_PRODUCTION_JOB_PHASES.FAILED,
      errorMessage: message,
      jobCompletedAt: new Date(),
    });

    if (audit?.actor) {
      await logBackupAuditEvent({
        actor: audit.actor,
        actionType: "dr_backup_failed",
        metadata: {
          moduleId: input.moduleId,
          storageProvider: input.storageProvider,
          stage,
          message,
          asyncJob: true,
          workerId,
          engine: "disaster-recovery-v2",
        },
        outcome: "failure",
        descriptionAr: "فشل إنشاء نسخة كوارث كاملة (مهمة خلفية)",
      }).catch(() => undefined);
    }

    throw error;
  } finally {
    stopV2WorkerHeartbeat();
    await releaseDrWorkerJobLock(recordId, workerId);
  }
};
