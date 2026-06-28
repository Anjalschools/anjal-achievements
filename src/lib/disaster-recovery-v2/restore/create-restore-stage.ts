import type { RestoreConfig } from "@/lib/disaster-recovery-v2/restore/restore-config";
import type { AssetRestoreProvider } from "@/lib/disaster-recovery-v2/restore/asset-restore-provider";
import type { RestoreEngineDependencies } from "@/lib/disaster-recovery-v2/restore/restore-dependencies";
import { executeRestore } from "@/lib/disaster-recovery-v2/restore/restore-engine";
import { RESTORE_STAGE_ID, type RestoreStageContract } from "@/lib/disaster-recovery-v2/restore/restore-stage";
import type { BackupContext } from "@/lib/disaster-recovery-v2/types/backup-context";
import { createStageResult } from "@/lib/disaster-recovery-v2/types/stage-result";

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const toRestoreConfig = (context: BackupContext): RestoreConfig => ({
  jobId: context.config.jobId,
  workspaceDir: context.config.workspaceDir,
  initiatedBy: context.config.initiatedBy,
  restoreMode: "replace",
});

export const createRestoreStage = (
  assetProvider: AssetRestoreProvider,
  deps: RestoreEngineDependencies
): RestoreStageContract => ({
  id: RESTORE_STAGE_ID,
  name: "Restore",
  execute: async (context) => {
    const startedAt = new Date();

    try {
      const result = await executeRestore(toRestoreConfig(context), assetProvider, deps);
      context.artifacts.restore = {
        reportPath: result.reportPath,
        report: result.report,
      };

      return createStageResult({
        stageId: RESTORE_STAGE_ID,
        success: result.success,
        startedAt,
        completedAt: new Date(result.completedAt),
        errors: result.report.errors.map((message) => ({
          code: "RESTORE_FAILURE",
          message,
        })),
        warnings: result.report.warnings.map((message) => ({
          code: "RESTORE_WARNING",
          message,
        })),
      });
    } catch (error) {
      return createStageResult({
        stageId: RESTORE_STAGE_ID,
        success: false,
        startedAt,
        errors: [{ code: "RESTORE_ABORTED", message: toErrorMessage(error) }],
      });
    }
  },
});
