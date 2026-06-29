import "server-only";

import { rmSync } from "fs";

import connectDB from "@/lib/mongodb";
import AcademicYear from "@/models/AcademicYear";
import BackupRecord from "@/models/BackupRecord";
import type { BackupModuleId, BackupStorageProviderId } from "@/lib/backup/backup-constants";
import type { RetentionTier } from "@/models/BackupRecord";
import { PACKAGE_MANIFEST_VERSION } from "@/lib/disaster-recovery-v2/package/package-manifest-types";
import type { AssetDownloadReport } from "@/lib/disaster-recovery-v2/storage/asset-download/asset-download-report-types";
import type { DatabaseManifest } from "@/lib/disaster-recovery-v2/database/database-manifest-types";
import type { UploadReport } from "@/lib/disaster-recovery-v2/upload/upload-artifact-types";
import type { PackageManifest } from "@/lib/disaster-recovery-v2/package/package-manifest-types";
import { resolveBackupWorkspaceDir } from "@/lib/disaster-recovery-v2/production/resolve-backup-workspace-dir";
import { runProductionV2Backup } from "@/lib/disaster-recovery-v2/production/run-production-v2-backup";
import { V2_PRODUCTION_JOB_PHASES } from "@/lib/disaster-recovery-v2/production/v2-production-stage-mapping";
import { persistV2ProductionProgress } from "@/lib/disaster-recovery-v2/production/v2-production-progress";
import {
  logMemoryAtFailure,
} from "@/lib/disaster-recovery-v2/diagnostics/v2-memory-diagnostics";

export type ExecuteProductionV2BackupInput = {
  recordId: string;
  fileName: string;
  moduleId: BackupModuleId;
  storageProvider: BackupStorageProviderId;
  createdByUserId: string;
  includeObjects?: boolean;
  retentionTier?: RetentionTier;
  note?: string;
  workerId?: string;
  assertNotCancelled?: () => Promise<void>;
};

export type ExecuteProductionV2BackupResult = {
  recordId: string;
  fileName: string;
  sizeBytes: number;
  storageProvider: BackupStorageProviderId;
  storageKey?: string;
  manifestVersion: string;
  recordCounts: Record<string, number>;
  objectCount: number;
  objectSizeBytes: number;
  recoveryReadinessScore: number;
};

export class ProductionV2BackupError extends Error {
  constructor(
    message: string,
    readonly stage: string
  ) {
    super(message);
    this.name = "ProductionV2BackupError";
  }
}

const buildRecordCounts = (manifest?: DatabaseManifest): Record<string, number> => {
  if (!manifest) return {};
  const counts: Record<string, number> = {};
  for (const collection of manifest.database.exportedCollections) {
    counts[collection.name] = collection.documentCount;
  }
  return counts;
};

const computeRecoveryReadinessScore = (input: {
  includeObjects: boolean;
  assetReport?: AssetDownloadReport;
}): number => {
  if (!input.includeObjects) return 50;
  if (!input.assetReport || input.assetReport.totalAssets === 0) return 50;
  const successful = input.assetReport.downloaded + input.assetReport.skipped;
  return Math.round((successful / input.assetReport.totalAssets) * 100);
};

const readArtifacts = (context: {
  artifacts: Record<string, unknown>;
}): {
  databaseManifest?: DatabaseManifest;
  assetReport?: AssetDownloadReport;
  uploadReport?: UploadReport;
  packageManifest?: PackageManifest;
} => {
  const databaseArtifact = context.artifacts.database as
    | { manifest?: DatabaseManifest }
    | undefined;
  const assetArtifact = context.artifacts.assetDownload as
    | { report?: AssetDownloadReport }
    | undefined;
  const uploadArtifact = context.artifacts.upload as { report?: UploadReport } | undefined;
  const packageArtifact = context.artifacts.packageBuild as
    | { manifest?: PackageManifest }
    | undefined;

  return {
    databaseManifest: databaseArtifact?.manifest,
    assetReport: assetArtifact?.report,
    uploadReport: uploadArtifact?.report,
    packageManifest: packageArtifact?.manifest,
  };
};

export const executeProductionV2Backup = async (
  input: ExecuteProductionV2BackupInput
): Promise<ExecuteProductionV2BackupResult> => {
  const workspaceDir = resolveBackupWorkspaceDir(input.recordId);
  const includeObjects = input.includeObjects !== false;

  try {
    const { result, context } = await runProductionV2Backup({
      recordId: input.recordId,
      workspaceDir,
      workerId: input.workerId,
      scope: "full",
      assertNotCancelled: input.assertNotCancelled,
    });

    if (!result.success) {
      const failedStage = result.stageResults.find((stage) => !stage.success);
      const message =
        failedStage?.errors[0]?.message ??
        failedStage?.errors[0]?.code ??
        "V2 backup failed";
      throw new ProductionV2BackupError(message, failedStage?.stageId ?? "unknown");
    }

    const artifacts = readArtifacts(context);
    const uploadReport = artifacts.uploadReport;
    if (!uploadReport) {
      throw new ProductionV2BackupError("UPLOAD_REPORT_MISSING", "upload");
    }

    const assetReport = artifacts.assetReport;
    const objectCount = includeObjects
      ? assetReport?.downloaded ?? artifacts.packageManifest?.assets.downloaded ?? 0
      : 0;
    const objectSizeBytes = includeObjects ? assetReport?.totalBytes ?? 0 : 0;
    const recoveryReadinessScore = computeRecoveryReadinessScore({
      includeObjects,
      assetReport,
    });
    const recordCounts = buildRecordCounts(artifacts.databaseManifest);

    await connectDB();
    const current = await AcademicYear.findOne({ isCurrent: true }).select("label name").lean();
    const academicYear = current ? String(current.label || current.name || "") : null;

    const resolvedStorageProvider =
      uploadReport.provider === "r2" ? "r2" : input.storageProvider;

    await BackupRecord.findByIdAndUpdate(input.recordId, {
      status: "completed",
      sizeBytes: uploadReport.bytes,
      manifestVersion: String(PACKAGE_MANIFEST_VERSION),
      storageProvider: resolvedStorageProvider,
      storageKey: uploadReport.objectKey,
      fileName: input.fileName,
      recordCounts,
      academicYearLabel: academicYear ?? undefined,
      note: input.note,
      objectCount,
      objectSizeBytes,
      recoveryReadinessScore,
      retentionTier: input.retentionTier || "daily",
      validationStatus: "pending",
      includesObjectStorage: includeObjects,
      jobPhase: V2_PRODUCTION_JOB_PHASES.COMPLETED,
      processedObjects: objectCount,
      totalObjects: includeObjects ? assetReport?.totalAssets ?? objectCount : 0,
      bytesExported: objectSizeBytes,
      jobCompletedAt: new Date(),
      errorMessage: undefined,
    });

    return {
      recordId: input.recordId,
      fileName: input.fileName,
      sizeBytes: uploadReport.bytes,
      storageProvider: resolvedStorageProvider,
      storageKey: uploadReport.objectKey,
      manifestVersion: String(PACKAGE_MANIFEST_VERSION),
      recordCounts,
      objectCount,
      objectSizeBytes,
      recoveryReadinessScore,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stage = error instanceof ProductionV2BackupError ? error.stage : "unknown";
    logMemoryAtFailure(stage, error, { recordId: input.recordId });
    await persistV2ProductionProgress(input.recordId, {
      jobPhase: V2_PRODUCTION_JOB_PHASES.FAILED,
      workerId: input.workerId,
    });
    await connectDB();
    await BackupRecord.findByIdAndUpdate(input.recordId, {
      status: "failed",
      jobPhase: V2_PRODUCTION_JOB_PHASES.FAILED,
      errorMessage: message,
      jobCompletedAt: new Date(),
    });
    throw error;
  } finally {
    rmSync(workspaceDir, { recursive: true, force: true });
  }
};
