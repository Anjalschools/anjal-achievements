import type { BackupContext } from "@/lib/disaster-recovery-v2/types/backup-context";
import type { StageResult } from "@/lib/disaster-recovery-v2/types/stage-result";

export const BACKUP_STAGE_IDS = [
  "database",
  "storage-inventory",
  "asset-download",
  "package-build",
  "verification",
  "upload",
] as const;

export type BackupStageId = (typeof BACKUP_STAGE_IDS)[number];

export interface BackupStage {
  readonly id: BackupStageId;
  readonly name: string;
  execute(context: BackupContext): Promise<StageResult>;
}
