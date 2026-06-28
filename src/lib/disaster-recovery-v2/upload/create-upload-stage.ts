import type { PackageManifest } from "@/lib/disaster-recovery-v2/package/package-manifest-types";
import type { UploadDependencies } from "@/lib/disaster-recovery-v2/upload/upload-dependencies";
import { resolveUploadInputPaths } from "@/lib/disaster-recovery-v2/upload/upload-dependencies";
import { resolveUploadReportPath } from "@/lib/disaster-recovery-v2/upload/upload-paths";
import type { BackupUploadProvider } from "@/lib/disaster-recovery-v2/upload/upload-provider";
import type { UploadArtifact, UploadReport, UploadResult } from "@/lib/disaster-recovery-v2/upload/upload-artifact-types";
import {
  MAX_UPLOAD_ATTEMPTS,
  UploadProviderError,
  isPermanentUploadError,
  isTransientUploadError,
  toUploadFailureReason,
} from "@/lib/disaster-recovery-v2/upload/upload-retry-policy";
import { UPLOAD_STAGE_ID, type UploadStage } from "@/lib/disaster-recovery-v2/verify/upload-stage";
import type { BackupContext } from "@/lib/disaster-recovery-v2/types/backup-context";
import { createStageResult } from "@/lib/disaster-recovery-v2/types/stage-result";
import { logDrV2 } from "@/lib/disaster-recovery-v2/utils/logging";

const verifyUploadArtifact = async (input: {
  backupZipPath: string;
  packageManifest: PackageManifest;
  statFile: UploadDependencies["statFile"];
  computeSha256: UploadDependencies["computeSha256"];
}): Promise<UploadArtifact> => {
  const fileStat = await input.statFile(input.backupZipPath);
  if (fileStat.size <= 0) {
    throw new UploadProviderError("UPLOAD_SIZE_MISMATCH:backup.zip is empty", { permanent: true });
  }

  if (fileStat.size !== input.packageManifest.package.size) {
    throw new UploadProviderError(
      `UPLOAD_SIZE_MISMATCH:expected=${input.packageManifest.package.size},actual=${fileStat.size}`,
      { permanent: true }
    );
  }

  const fileSha256 = await input.computeSha256(input.backupZipPath);
  if (fileSha256 !== input.packageManifest.package.sha256) {
    throw new UploadProviderError("UPLOAD_CHECKSUM_MISMATCH", { permanent: true });
  }

  return {
    path: input.backupZipPath,
    sha256: fileSha256,
    size: fileStat.size,
    filename: input.packageManifest.package.zipFile,
  };
};

const verifyUploadResult = (artifact: UploadArtifact, result: UploadResult): void => {
  if (result.uploadedBytes !== artifact.size) {
    throw new UploadProviderError(
      `UPLOAD_BYTE_COUNT_MISMATCH:expected=${artifact.size},actual=${result.uploadedBytes}`,
      { permanent: true }
    );
  }
};

const uploadWithRetry = async (input: {
  provider: BackupUploadProvider;
  artifact: UploadArtifact;
  context: BackupContext;
  sleep: UploadDependencies["sleep"];
}): Promise<UploadResult> => {
  let attempts = 0;
  let lastError: unknown;

  while (attempts < MAX_UPLOAD_ATTEMPTS) {
    attempts += 1;

    try {
      return await input.provider.upload(input.artifact, input.context);
    } catch (error) {
      lastError = error;

      if (isPermanentUploadError(error) || attempts >= MAX_UPLOAD_ATTEMPTS) {
        break;
      }

      if (isTransientUploadError(error)) {
        await input.sleep(0);
        continue;
      }

      break;
    }
  }

  throw lastError instanceof Error ? lastError : new UploadProviderError(String(lastError));
};

export const executeUploadStage = async (
  context: BackupContext,
  provider: BackupUploadProvider,
  deps: UploadDependencies
): Promise<{
  report: UploadReport;
  reportPath: string;
  uploadResult: UploadResult;
  stageStartedAt: Date;
}> => {
  const stageStartedAt = new Date();
  const { workspaceDir, jobId } = context.config;
  const { backupZipPath, packageManifestPath } = resolveUploadInputPaths(workspaceDir);
  const reportPath = resolveUploadReportPath(workspaceDir);

  const packageManifest = await deps.readPackageManifest(packageManifestPath);
  const artifact = await verifyUploadArtifact({
    backupZipPath,
    packageManifest,
    statFile: deps.statFile,
    computeSha256: deps.computeSha256,
  });

  logDrV2("UPLOAD_PROVIDER_STARTED", {
    jobId,
    provider: provider.id,
    filename: artifact.filename,
    bytes: artifact.size,
  });

  const uploadStartedAt = Date.now();
  const uploadResult = await uploadWithRetry({
    provider,
    artifact,
    context,
    sleep: deps.sleep,
  });

  logDrV2("UPLOAD_PROVIDER_COMPLETED", {
    jobId,
    provider: provider.id,
    success: true,
    objectKey: uploadResult.objectKey,
    uploadedBytes: uploadResult.uploadedBytes,
    durationMs: Date.now() - uploadStartedAt,
  });

  verifyUploadResult(artifact, uploadResult);

  logDrV2("UPLOAD_VERIFIED", {
    jobId,
    provider: provider.id,
    objectKey: uploadResult.objectKey,
    uploadedBytes: uploadResult.uploadedBytes,
    etag: uploadResult.etag,
  });

  const report: UploadReport = {
    provider: uploadResult.provider,
    filename: artifact.filename,
    bytes: artifact.size,
    sha256: artifact.sha256,
    uploadedAt: uploadResult.completedAt.toISOString(),
    objectKey: uploadResult.objectKey,
    etag: uploadResult.etag,
    durationMs: Date.now() - uploadStartedAt,
  };

  await deps.writeUploadReport(reportPath, report);

  return {
    report,
    reportPath,
    uploadResult,
    stageStartedAt,
  };
};

export const createUploadStage = (
  provider: BackupUploadProvider,
  deps: UploadDependencies
): UploadStage => ({
  id: UPLOAD_STAGE_ID,
  name: "Upload",
  execute: async (context) => {
    const stageStartedAt = new Date();

    logDrV2("UPLOAD_STAGE_STARTED", {
      jobId: context.config.jobId,
    });

    try {
      const result = await executeUploadStage(context, provider, deps);
      const completedAt = new Date();

      context.artifacts.upload = {
        reportPath: result.reportPath,
        report: result.report,
        uploadResult: result.uploadResult,
      };

      logDrV2("UPLOAD_STAGE_COMPLETED", {
        jobId: context.config.jobId,
        success: true,
        provider: result.uploadResult.provider,
        objectKey: result.uploadResult.objectKey,
        bytes: result.report.bytes,
        durationMs: completedAt.getTime() - stageStartedAt.getTime(),
      });

      return createStageResult({
        stageId: UPLOAD_STAGE_ID,
        success: true,
        startedAt: stageStartedAt,
        completedAt,
      });
    } catch (error) {
      const message = toUploadFailureReason(error);
      const completedAt = new Date();

      logDrV2("UPLOAD_STAGE_COMPLETED", {
        jobId: context.config.jobId,
        success: false,
        message,
        durationMs: completedAt.getTime() - stageStartedAt.getTime(),
      });

      return createStageResult({
        stageId: UPLOAD_STAGE_ID,
        success: false,
        startedAt: stageStartedAt,
        completedAt,
        errors: [{ code: "UPLOAD_FAILED", message }],
      });
    }
  },
});
