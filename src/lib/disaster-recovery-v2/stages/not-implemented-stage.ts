import type { BackupStage, BackupStageId } from "@/lib/disaster-recovery-v2/types/stage";
import type { BackupContext } from "@/lib/disaster-recovery-v2/types/backup-context";
import { createStageResult } from "@/lib/disaster-recovery-v2/types/stage-result";

export const createNotImplementedStage = (input: {
  id: BackupStageId;
  name: string;
}): BackupStage => ({
  id: input.id,
  name: input.name,
  execute: async (_context: BackupContext) => {
    const startedAt = new Date();
    return createStageResult({
      stageId: input.id,
      success: true,
      startedAt,
      warnings: [
        {
          code: "NOT_IMPLEMENTED",
          message: `${input.name} is not implemented in DR.BACKUP.V2 yet.`,
        },
      ],
    });
  },
});
