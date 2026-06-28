import type { BackupStage } from "@/lib/disaster-recovery-v2/types/stage";

export const ASSET_DOWNLOAD_STAGE_ID = "asset-download" as const;

export type AssetDownloadStage = BackupStage & {
  readonly id: typeof ASSET_DOWNLOAD_STAGE_ID;
};
