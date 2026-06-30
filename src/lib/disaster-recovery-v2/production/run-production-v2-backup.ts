import "server-only";

import type { AssetDownloadReport } from "@/lib/disaster-recovery-v2/storage/asset-download/asset-download-report-types";
import type { BackupContext } from "@/lib/disaster-recovery-v2/types/backup-context";
import { createBackupConfig } from "@/lib/disaster-recovery-v2/types/backup-config";
import { createBackupContext } from "@/lib/disaster-recovery-v2/types/backup-context";
import { buildBackupResult, type BackupResult } from "@/lib/disaster-recovery-v2/types/backup-result";
import type { BackupStageId } from "@/lib/disaster-recovery-v2/types/stage";
import type { StageResult } from "@/lib/disaster-recovery-v2/types/stage-result";
import {
  logDrV2,
  logDrV2StageCompleted,
  logDrV2StageStarted,
} from "@/lib/disaster-recovery-v2/utils/logging";
import { createProductionIntegratedV2BackupEngine } from "@/lib/disaster-recovery-v2/production/create-production-integrated-backup-engine";
import {
  beginV2MemoryDiagnosticsSession,
  endV2MemoryDiagnosticsSession,
  getV2MemoryDiagnosticsSnapshot,
  logMemoryAtFailure,
  logMemorySnapshot,
  logV2JobDiagnosticSummary,
  markV2MemoryDiagnosticsStageComplete,
  recordV2PackageBuildDurationMs,
  recordV2UploadDurationMs,
  setV2MemoryDiagnosticsCurrentStage,
} from "@/lib/disaster-recovery-v2/diagnostics/v2-memory-diagnostics";
import { resetV2StreamRegistry } from "@/lib/disaster-recovery-v2/diagnostics/v2-stream-registry";
import { resolveV2StageMemoryCheckpoints } from "@/lib/disaster-recovery-v2/diagnostics/v2-stage-memory-checkpoints";
import {
  mapV2StageIdToProductionJobPhase,
  resolvePackageBuildRunningJobPhase,
  V2_PRODUCTION_JOB_PHASES,
} from "@/lib/disaster-recovery-v2/production/v2-production-stage-mapping";
import { persistV2ProductionProgress } from "@/lib/disaster-recovery-v2/production/v2-production-progress";

const readAssetDownloadReport = (context: BackupContext): AssetDownloadReport | undefined => {
  const artifact = context.artifacts.assetDownload as
    | { report?: AssetDownloadReport }
    | undefined;
  return artifact?.report;
};

const readStorageInventorySummary = (
  context: BackupContext
): { objectCount?: number; totalBytes?: number } | undefined => {
  const artifact = context.artifacts.storageInventory as
    | { manifest?: { objectCount?: number; totalBytes?: number } }
    | undefined;
  return artifact?.manifest;
};

const syncProgressAfterStage = async (input: {
  recordId: string;
  workerId?: string;
  stageId: BackupStageId;
  context: BackupContext;
}): Promise<void> => {
  const jobPhase = mapV2StageIdToProductionJobPhase(input.stageId);
  const assetReport = readAssetDownloadReport(input.context);
  const storageSummary = readStorageInventorySummary(input.context);

  if (input.stageId === "storage-inventory" && storageSummary?.objectCount !== undefined) {
    await persistV2ProductionProgress(input.recordId, {
      jobPhase,
      totalObjects: storageSummary.objectCount,
      processedObjects: 0,
      workerId: input.workerId,
    });
    return;
  }

  if (input.stageId === "asset-download" && assetReport) {
    await persistV2ProductionProgress(input.recordId, {
      jobPhase,
      totalObjects: assetReport.totalAssets,
      processedObjects: assetReport.downloaded + assetReport.skipped,
      bytesExported: assetReport.totalBytes,
      workerId: input.workerId,
    });
    return;
  }

  await persistV2ProductionProgress(input.recordId, {
    jobPhase,
    workerId: input.workerId,
  });
};

export const runProductionV2Backup = async (input: {
  recordId: string;
  workspaceDir: string;
  workerId?: string;
  scope?: "full" | "partial";
  assertNotCancelled?: () => Promise<void>;
}): Promise<{ result: BackupResult; context: BackupContext }> => {
  const engine = createProductionIntegratedV2BackupEngine();
  const config = createBackupConfig({
    jobId: input.recordId,
    workspaceDir: input.workspaceDir,
    scope: input.scope ?? "full",
  });
  const context = createBackupContext(config);
  const backupStartedAt = context.startedAt;

  beginV2MemoryDiagnosticsSession(config.jobId);
  resetV2StreamRegistry();
  logMemorySnapshot("JOB_START", { workerId: input.workerId });

  logDrV2("BACKUP_STARTED", {
    jobId: config.jobId,
    workspaceDir: config.workspaceDir,
    stageCount: engine.getRegisteredStageIds().length,
  });

  await persistV2ProductionProgress(input.recordId, {
    jobPhase: V2_PRODUCTION_JOB_PHASES.STARTING,
    workerId: input.workerId,
  });

  try {
    for (const stageId of engine.getRegisteredStageIds()) {
      const stage = engine.getStage(stageId);
      if (!stage) continue;

      if (input.assertNotCancelled) {
        await input.assertNotCancelled();
      }

      const runningPhase =
        stageId === "package-build"
          ? resolvePackageBuildRunningJobPhase()
          : mapV2StageIdToProductionJobPhase(stageId);
      await persistV2ProductionProgress(input.recordId, {
        jobPhase: runningPhase,
        workerId: input.workerId,
      });

      const checkpoints = resolveV2StageMemoryCheckpoints(stageId);
      setV2MemoryDiagnosticsCurrentStage(checkpoints.start[0] ?? stageId);
      for (const checkpoint of checkpoints.start) {
        logMemorySnapshot(checkpoint, { stageId: stage.id, stageName: stage.name });
      }

      logDrV2StageStarted(stage.id, { jobId: config.jobId, stageName: stage.name });

      const stageStartedAt = Date.now();
      let stageResult: StageResult;
      try {
        stageResult = await stage.execute(context);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logMemoryAtFailure(checkpoints.start[0] ?? stageId, error, { stageId: stage.id });
        const failedAt = new Date();
        stageResult = {
          stageId: stage.id,
          success: false,
          startedAt: failedAt.toISOString(),
          completedAt: failedAt.toISOString(),
          durationMs: 0,
          warnings: [],
          errors: [{ code: "STAGE_EXECUTION_FAILED", message }],
        };
      }

      const stageDurationMs = Date.now() - stageStartedAt;
      if (stageId === "package-build") {
        recordV2PackageBuildDurationMs(stageDurationMs);
      }
      if (stageId === "upload") {
        recordV2UploadDurationMs(stageDurationMs);
      }

      context.stageResults.push(stageResult);

      for (const checkpoint of checkpoints.complete) {
        logMemorySnapshot(checkpoint, {
          stageId: stage.id,
          stageName: stage.name,
          success: stageResult.success,
          durationMs: stageDurationMs,
        });
      }
      markV2MemoryDiagnosticsStageComplete(checkpoints.complete[0] ?? stageId);

      logDrV2StageCompleted(stage.id, {
        jobId: config.jobId,
        durationMs: stageResult.durationMs,
        success: stageResult.success,
      });

      await syncProgressAfterStage({
        recordId: input.recordId,
        workerId: input.workerId,
        stageId,
        context,
      });

      if (!stageResult.success) {
        logMemoryAtFailure(checkpoints.complete[0] ?? stageId, stageResult.errors[0]?.message ?? "STAGE_FAILED", {
          stageId: stage.id,
        });
        logDrV2("STAGE_FAILED", {
          jobId: config.jobId,
          stageId: stage.id,
          errors: stageResult.errors,
        });
        break;
      }
    }

    const completedAt = new Date().toISOString();
    const result = buildBackupResult({
      jobId: config.jobId,
      startedAt: backupStartedAt,
      completedAt,
      stageResults: context.stageResults,
    });

    logDrV2(result.success ? "BACKUP_COMPLETED" : "BACKUP_FAILED", {
      jobId: config.jobId,
      durationMs: result.durationMs,
      stageCount: result.stageResults.length,
    });

    logV2JobDiagnosticSummary({ success: result.success, jobId: config.jobId });

    if (result.success) {
      await persistV2ProductionProgress(input.recordId, {
        jobPhase: V2_PRODUCTION_JOB_PHASES.COMPLETED,
        workerId: input.workerId,
      });
    }

    return { result, context };
  } catch (error) {
    logMemoryAtFailure(getV2MemoryDiagnosticsSnapshot().currentStage ?? "unknown", error);
    logV2JobDiagnosticSummary({ success: false, jobId: config.jobId });
    throw error;
  } finally {
    endV2MemoryDiagnosticsSession();
    resetV2StreamRegistry();
  }
};
