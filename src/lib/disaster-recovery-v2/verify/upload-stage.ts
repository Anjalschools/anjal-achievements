import type { BackupStage } from "@/lib/disaster-recovery-v2/types/stage";

export const UPLOAD_STAGE_ID = "upload" as const;

export type UploadStage = BackupStage & {
  readonly id: typeof UPLOAD_STAGE_ID;
};
