import type { BackupContext } from "@/lib/disaster-recovery-v2/types/backup-context";
import type { StageResult } from "@/lib/disaster-recovery-v2/types/stage-result";

export const RESTORE_STAGE_ID = "restore" as const;

export type RestoreStageContract = {
  readonly id: typeof RESTORE_STAGE_ID;
  readonly name: string;
  execute(context: BackupContext): Promise<StageResult>;
};
