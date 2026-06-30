import type { BackupStageId } from "@/lib/disaster-recovery-v2/types/stage";

export const resolveV2StageMemoryCheckpoints = (
  stageId: BackupStageId
): { start: string[]; complete: string[] } => {
  switch (stageId) {
    case "database":
      return {
        start: ["DATABASE_EXPORT_START"],
        complete: ["DATABASE_EXPORT_COMPLETE"],
      };
    case "storage-inventory":
      return {
        start: ["DISCOVERY_START", "ASSET_DISCOVERY_START"],
        complete: ["DISCOVERY_COMPLETE", "ASSET_DISCOVERY_COMPLETE"],
      };
    case "asset-download":
      return {
        start: ["ASSET_DOWNLOAD_START"],
        complete: ["ASSET_DOWNLOAD_COMPLETE"],
      };
    case "package-build":
      return {
        start: ["R2_DISCOVERY_START"],
        complete: ["PACKAGE_BUILD_COMPLETE"],
      };
    case "upload":
      return {
        start: ["UPLOAD_START"],
        complete: ["UPLOAD_COMPLETE"],
      };
    default:
      return { start: [`${stageId.toUpperCase()}_START`], complete: [`${stageId.toUpperCase()}_COMPLETE`] };
  }
};
