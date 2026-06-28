import type { BackupConfig } from "@/lib/disaster-recovery-v2/types/backup-config";
import { createBackupContext, type BackupContext } from "@/lib/disaster-recovery-v2/types/backup-context";
import { buildBackupResult, type BackupResult } from "@/lib/disaster-recovery-v2/types/backup-result";
import type { BackupStage, BackupStageId } from "@/lib/disaster-recovery-v2/types/stage";
import type { StageResult } from "@/lib/disaster-recovery-v2/types/stage-result";
import {
  logDrV2,
  logDrV2StageCompleted,
  logDrV2StageStarted,
} from "@/lib/disaster-recovery-v2/utils/logging";

export type BackupEngineOptions = {
  stopOnFirstFailure?: boolean;
};

export class BackupEngine {
  private readonly stages = new Map<BackupStageId, BackupStage>();
  private readonly stageOrder: BackupStageId[] = [];
  private readonly options: BackupEngineOptions;

  constructor(options: BackupEngineOptions = {}) {
    this.options = {
      stopOnFirstFailure: options.stopOnFirstFailure ?? true,
    };
  }

  registerStage(stage: BackupStage): this {
    if (this.stages.has(stage.id)) {
      throw new Error(`BACKUP_STAGE_ALREADY_REGISTERED:${stage.id}`);
    }
    this.stages.set(stage.id, stage);
    this.stageOrder.push(stage.id);
    return this;
  }

  getRegisteredStageIds(): BackupStageId[] {
    return [...this.stageOrder];
  }

  getStage(id: BackupStageId): BackupStage | undefined {
    return this.stages.get(id);
  }

  async run(config: BackupConfig): Promise<BackupResult> {
    const context = createBackupContext(config);
    const backupStartedAt = context.startedAt;

    logDrV2("BACKUP_STARTED", {
      jobId: config.jobId,
      workspaceDir: config.workspaceDir,
      stageCount: this.stageOrder.length,
    });

    for (const stageId of this.stageOrder) {
      const stage = this.stages.get(stageId);
      if (!stage) continue;

      logDrV2StageStarted(stage.id, { jobId: config.jobId, stageName: stage.name });

      let stageResult: StageResult;
      try {
        stageResult = await stage.execute(context);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
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

      context.stageResults.push(stageResult);

      logDrV2StageCompleted(stage.id, {
        jobId: config.jobId,
        durationMs: stageResult.durationMs,
        success: stageResult.success,
      });

      if (!stageResult.success) {
        logDrV2("STAGE_FAILED", {
          jobId: config.jobId,
          stageId: stage.id,
          errors: stageResult.errors,
        });
        if (this.options.stopOnFirstFailure) {
          break;
        }
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

    return result;
  }
}

export { createBackupContext };
export type { BackupConfig, BackupContext, BackupResult, BackupStage, StageResult };
