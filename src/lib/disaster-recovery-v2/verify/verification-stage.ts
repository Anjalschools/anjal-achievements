import type { BackupStage } from "@/lib/disaster-recovery-v2/types/stage";

export const VERIFICATION_STAGE_ID = "verification" as const;

export type VerificationStage = BackupStage & {
  readonly id: typeof VERIFICATION_STAGE_ID;
};
