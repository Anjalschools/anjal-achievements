import type { BackupStageId } from "@/lib/disaster-recovery-v2/types/stage";

export const V2_PRODUCTION_JOB_PHASES = {
  QUEUED: "queued",
  STARTING: "starting",
  DATABASE_EXPORT: "DATABASE_EXPORT",
  STORAGE_DISCOVERY: "STORAGE_DISCOVERY",
  ASSET_DOWNLOAD: "ASSET_DOWNLOAD",
  R2_DISCOVERY: "R2_DISCOVERY",
  R2_EXPORT: "R2_EXPORT",
  R2_VERIFICATION: "R2_VERIFICATION",
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

/** Progress phase when the package-build pipeline stage begins (before ZIP creation). */
export const resolvePackageBuildRunningJobPhase = (): V2ProductionJobPhase =>
  V2_PRODUCTION_JOB_PHASES.R2_DISCOVERY;

const V2_PRODUCTION_JOB_PHASE_LABELS_AR: Record<string, string> = {
  [V2_PRODUCTION_JOB_PHASES.QUEUED]: "في الانتظار",
  [V2_PRODUCTION_JOB_PHASES.STARTING]: "جاري البدء",
  [V2_PRODUCTION_JOB_PHASES.DATABASE_EXPORT]: "جاري تصدير قاعدة البيانات",
  [V2_PRODUCTION_JOB_PHASES.STORAGE_DISCOVERY]: "جاري اكتشاف ملفات التخزين",
  [V2_PRODUCTION_JOB_PHASES.ASSET_DOWNLOAD]: "جاري تنزيل ملفات Cloudinary",
  [V2_PRODUCTION_JOB_PHASES.R2_DISCOVERY]: "جاري اكتشاف ملفات Cloudflare R2",
  [V2_PRODUCTION_JOB_PHASES.R2_EXPORT]: "جاري تصدير ملفات Cloudflare R2",
  [V2_PRODUCTION_JOB_PHASES.R2_VERIFICATION]: "جارٍ التحقق من ملفات R2",
  [V2_PRODUCTION_JOB_PHASES.PACKAGE_BUILD]: "جاري إنشاء حزمة النسخة الاحتياطية",
  [V2_PRODUCTION_JOB_PHASES.UPLOAD]: "جاري رفع النسخة الاحتياطية",
  [V2_PRODUCTION_JOB_PHASES.COMPLETED]: "اكتمل",
  [V2_PRODUCTION_JOB_PHASES.FAILED]: "فشل",
  [V2_PRODUCTION_JOB_PHASES.CANCELLED]: "أُلغي",
};

export const formatV2ProductionJobPhaseLabelAr = (jobPhase?: string): string => {
  if (!jobPhase) return V2_PRODUCTION_JOB_PHASE_LABELS_AR[V2_PRODUCTION_JOB_PHASES.QUEUED];
  return V2_PRODUCTION_JOB_PHASE_LABELS_AR[jobPhase] ?? jobPhase;
};
