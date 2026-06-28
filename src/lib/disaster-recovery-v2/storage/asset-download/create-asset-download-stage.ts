import {
  resolveAssetDownloadReportPath,
  resolveAssetsRootDir,
  resolveMetadataRootDir,
  resolveMissingAssetsPath,
} from "@/lib/disaster-recovery-v2/storage/asset-download/asset-download-paths";
import type { AssetDownloadDependencies } from "@/lib/disaster-recovery-v2/storage/asset-download/asset-download-dependencies";
import { resolveInputStorageManifestPath } from "@/lib/disaster-recovery-v2/storage/asset-download/asset-download-dependencies";
import {
  createEmptyAssetDownloadReport,
  type AssetDownloadReport,
} from "@/lib/disaster-recovery-v2/storage/asset-download/asset-download-report-types";
import { downloadSingleAsset } from "@/lib/disaster-recovery-v2/storage/asset-download/download-single-asset";
import {
  createEmptyMissingAssetsManifest,
  type MissingAssetsManifest,
} from "@/lib/disaster-recovery-v2/storage/asset-download/missing-assets-types";
import { sortAssetsForDownload } from "@/lib/disaster-recovery-v2/storage/asset-download/resolve-asset-file-path";
import {
  ASSET_DOWNLOAD_STAGE_ID,
  type AssetDownloadStage,
} from "@/lib/disaster-recovery-v2/storage/asset-download-stage";
import type { BackupContext } from "@/lib/disaster-recovery-v2/types/backup-context";
import { createStageResult } from "@/lib/disaster-recovery-v2/types/stage-result";
import { logDrV2 } from "@/lib/disaster-recovery-v2/utils/logging";

const TERMINAL_STATUSES = new Set(["downloaded", "skipped", "missing", "failed"]);

export const executeAssetDownloadStage = async (
  context: BackupContext,
  deps: AssetDownloadDependencies
): Promise<{
  report: AssetDownloadReport;
  reportPath: string;
  missingAssetsPath: string;
  assetsRootDir: string;
  stageStartedAt: Date;
}> => {
  const stageStartedAt = new Date();
  const { workspaceDir, jobId } = context.config;
  const storageManifestPath = resolveInputStorageManifestPath(workspaceDir);
  const reportPath = resolveAssetDownloadReportPath(workspaceDir);
  const missingAssetsPath = resolveMissingAssetsPath(workspaceDir);
  const assetsRootDir = resolveAssetsRootDir(workspaceDir);

  await deps.ensureDirectory(assetsRootDir);
  await deps.ensureDirectory(resolveMetadataRootDir(workspaceDir));

  const storageManifest = await deps.readStorageManifest(storageManifestPath);
  const assets = sortAssetsForDownload(storageManifest.objects);

  const report = createEmptyAssetDownloadReport();
  report.totalAssets = assets.length;

  const missingAssets: MissingAssetsManifest = createEmptyMissingAssetsManifest();
  const stageWarnings: string[] = [];
  const stageFailures: string[] = [];

  for (const asset of assets) {
    const result = await downloadSingleAsset(asset, {
      workspaceDir,
      jobId,
      transport: deps.transport,
      ensureDirectory: deps.ensureDirectory,
      renameFile: deps.renameFile,
      removeFile: deps.removeFile,
      statFile: deps.statFile,
      computeSha256: deps.computeSha256,
      sleep: deps.sleep,
    });

    report.assets.push(result.reportEntry);
    report.retries += result.retries;

    if (result.reportEntry.status === "downloaded") {
      report.downloaded += 1;
      report.totalBytes += result.reportEntry.sizeBytes ?? 0;
    } else if (result.reportEntry.status === "skipped") {
      report.skipped += 1;
      if (result.reportEntry.warning) {
        stageWarnings.push(`${asset.objectId}:${result.reportEntry.warning}`);
      }
    } else if (result.reportEntry.status === "missing") {
      report.missing += 1;
      if (result.missingEntry) {
        missingAssets.entries.push(result.missingEntry);
      }
      stageFailures.push(`${asset.objectId}:${result.reportEntry.failure ?? "MISSING"}`);
    } else if (result.reportEntry.status === "failed") {
      report.failed += 1;
      stageFailures.push(`${asset.objectId}:${result.reportEntry.failure ?? "FAILED"}`);
    }
  }

  report.generatedAt = new Date().toISOString();
  report.durationMs = Date.now() - stageStartedAt.getTime();
  report.warnings = [...stageWarnings].sort((left, right) => left.localeCompare(right));
  report.failures = [...stageFailures].sort((left, right) => left.localeCompare(right));

  missingAssets.generatedAt = new Date().toISOString();
  missingAssets.entries.sort((left, right) => left.storageKey.localeCompare(right.storageKey));

  await deps.writeJsonFile(reportPath, report);
  if (missingAssets.entries.length > 0) {
    await deps.writeJsonFile(missingAssetsPath, missingAssets);
  }

  const pendingAssets = report.assets.filter((entry) => !TERMINAL_STATUSES.has(entry.status));
  if (pendingAssets.length > 0) {
    throw new Error(`ASSET_DOWNLOAD_INCOMPLETE:${pendingAssets.length}`);
  }

  return {
    report,
    reportPath,
    missingAssetsPath,
    assetsRootDir,
    stageStartedAt,
  };
};

export const createAssetDownloadStage = (deps: AssetDownloadDependencies): AssetDownloadStage => ({
  id: ASSET_DOWNLOAD_STAGE_ID,
  name: "Asset Download",
  execute: async (context) => {
    const { report, reportPath, missingAssetsPath, assetsRootDir, stageStartedAt } =
      await executeAssetDownloadStage(context, deps);

    const hasFailures = report.missing > 0 || report.failed > 0;

    context.artifacts.assetDownload = {
      reportPath,
      missingAssetsPath,
      assetsRootDir,
      report,
    };

    const completedAt = new Date();

    logDrV2("DOWNLOAD_STAGE_COMPLETED", {
      jobId: context.config.jobId,
      success: !hasFailures,
      totalAssets: report.totalAssets,
      downloaded: report.downloaded,
      skipped: report.skipped,
      missing: report.missing,
      failed: report.failed,
      retries: report.retries,
      durationMs: completedAt.getTime() - stageStartedAt.getTime(),
    });

    return createStageResult({
      stageId: ASSET_DOWNLOAD_STAGE_ID,
      success: !hasFailures,
      startedAt: stageStartedAt,
      completedAt,
      warnings: report.warnings.map((message) => ({
        code: "ASSET_DOWNLOAD_WARNING",
        message,
      })),
      errors: report.failures.map((message) => ({
        code: "ASSET_DOWNLOAD_FAILURE",
        message,
      })),
    });
  },
});
