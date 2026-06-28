import type { BackupStage } from "@/lib/disaster-recovery-v2/types/stage";

export const DATABASE_STAGE_ID = "database" as const;

export type DatabaseStage = BackupStage & {
  readonly id: typeof DATABASE_STAGE_ID;
};
