import type { BackupStageId } from "@/lib/disaster-recovery-v2/types/stage";

export const V2_PRODUCTION_JOB_PHASES = {
  QUEUED: "queued",
  STARTING: "starting",
  DATABASE_EXPORT: "DATABASE_EXPORT",
  STORAGE_DISCOVERY: "STORAGE_DISCOVERY",
  ASSET_DOWNLOAD: "ASSET_DOWNLOAD",
  PACKAGE_BUILD: "PACKAGE_BUILD",
  UPLOAD: "UPLOAD",
  COMPLETED: "COMPLETED",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

export type V2ProductionJobPhase =
  (typeof V2_PRODUCTION_JOB_PHASES)[keyof typeof V2_PRODUCTION_JOB_PHASES];

export const mapV2StageIdToProductionJobPhase = (
  stageId: BackupStageId
): V2ProductionJobPhase => {
  switch (stageId) {
    case "database":
      return V2_PRODUCTION_JOB_PHASES.DATABASE_EXPORT;
    case "storage-inventory":
      return V2_PRODUCTION_JOB_PHASES.STORAGE_DISCOVERY;
    case "asset-download":
      return V2_PRODUCTION_JOB_PHASES.ASSET_DOWNLOAD;
    case "package-build":
      return V2_PRODUCTION_JOB_PHASES.PACKAGE_BUILD;
    case "upload":
      return V2_PRODUCTION_JOB_PHASES.UPLOAD;
    default:
      return V2_PRODUCTION_JOB_PHASES.STARTING;
  }
};
