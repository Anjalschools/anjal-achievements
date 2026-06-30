import type { RestoreConfig } from "@/lib/disaster-recovery-v2/restore/restore-config";
import { createRestoreContext } from "@/lib/disaster-recovery-v2/restore/restore-context";
import { extractRestorePackage } from "@/lib/disaster-recovery-v2/restore/extract-restore-package";
import type { AssetRestoreProvider } from "@/lib/disaster-recovery-v2/restore/asset-restore-provider";
import { restoreAssets } from "@/lib/disaster-recovery-v2/restore/restore-assets";
import { restoreDatabaseCollections } from "@/lib/disaster-recovery-v2/restore/restore-database-collections";
import type { RestoreEngineDependencies } from "@/lib/disaster-recovery-v2/restore/restore-dependencies";
import {
  createDefaultAssetRestoreProvider,
  createDefaultRestoreEngineDependencies,
} from "@/lib/disaster-recovery-v2/restore/restore-dependencies";
import type { RestoreEngineResult } from "@/lib/disaster-recovery-v2/restore/restore-report-types";
import {
  resolveExtractedMetadataPath,
  resolveRestoreBackupZipPath,
  resolveRestoreReportPath,
} from "@/lib/disaster-recovery-v2/restore/restore-paths";
import { resolvePackageManifestPath } from "@/lib/disaster-recovery-v2/package/package-paths";
import { validateRestoreManifests } from "@/lib/disaster-recovery-v2/restore/validate-restore-manifests";
import { validateRestorePackage } from "@/lib/disaster-recovery-v2/restore/validate-restore-package";
import {
  buildRestoreReport,
  verifyRestoreOutcome,
} from "@/lib/disaster-recovery-v2/restore/verify-restore-result";
import { logDrV2 } from "@/lib/disaster-recovery-v2/utils/logging";

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const executeRestore = async (
  config: RestoreConfig,
  assetProvider: AssetRestoreProvider,
  deps: RestoreEngineDependencies
): Promise<RestoreEngineResult> => {
  const startedAt = new Date();
  const context = createRestoreContext(config);
  const backupZipPath = resolveRestoreBackupZipPath(config.workspaceDir, config.backupZipPath);
  const extractedRootDir = context.extractedRootDir;
  const reportPath = resolveRestoreReportPath(config.workspaceDir);

  logDrV2("RESTORE_STAGE_STARTED", {
    jobId: config.jobId,
    backupZipPath,
  });

  try {
    await validateRestorePackage({
      backupZipPath,
      deps: deps.validation,
      authoritativeManifestPath: resolvePackageManifestPath(config.workspaceDir),
      readAuthoritativeManifest: async (manifestPath) => {
        if (!(await deps.pathExists(manifestPath))) {
          return null;
        }

        return deps.readJsonFile(manifestPath);
      },
    });

    logDrV2("PACKAGE_VALIDATED", {
      jobId: config.jobId,
      backupZipPath,
    });

    await extractRestorePackage({
      backupZipPath,
      destinationDir: extractedRootDir,
      ensureDirectory: deps.ensureDirectory,
      extractor: deps.extractor,
    });

    logDrV2("PACKAGE_EXTRACTED", {
      jobId: config.jobId,
      extractedRootDir,
    });

    await validateRestoreManifests({
      extractedRootDir,
      pathExists: deps.pathExists,
    });

    logDrV2("DATABASE_RESTORE_STARTED", {
      jobId: config.jobId,
    });

    const collectionResults = await restoreDatabaseCollections({
      context,
      extractedRootDir,
      databaseManifestPath: resolveExtractedMetadataPath(extractedRootDir, "database-manifest.json"),
      deps: deps.database,
    });

    const assetResults = await restoreAssets({
      context,
      extractedRootDir,
      storageManifestPath: resolveExtractedMetadataPath(extractedRootDir, "storage-manifest.json"),
      provider: assetProvider,
      deps: deps.assets,
    });

    const r2RestoreResult = await deps.restoreR2Objects({
      extractedRootDir,
      jobId: config.jobId,
    });

    const verification = verifyRestoreOutcome({
      collectionResults,
      assetResults,
      r2RestoreResult,
    });

    logDrV2("RESTORE_VERIFIED", {
      jobId: config.jobId,
      verified: verification.verified,
      restoredCollections: verification.restoredCollections,
      restoredAssets: verification.restoredAssets,
      skippedAssets: verification.skippedAssets,
      failedAssets: verification.failedAssets,
    });

    const completedAt = new Date();
    const report = buildRestoreReport({
      jobId: config.jobId,
      restoreMode: config.restoreMode ?? "replace",
      backupZipPath,
      durationMs: completedAt.getTime() - startedAt.getTime(),
      collectionResults,
      assetResults,
      verification,
    });

    await deps.writeRestoreReport(reportPath, report);

    context.artifacts.restoreReport = report;

    logDrV2("RESTORE_STAGE_COMPLETED", {
      jobId: config.jobId,
      success: verification.verified,
      durationMs: report.durationMs,
    });

    return {
      success: verification.verified,
      jobId: config.jobId,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs: report.durationMs,
      reportPath,
      report,
    };
  } catch (error) {
    const message = toErrorMessage(error);
    const completedAt = new Date();

    logDrV2("RESTORE_STAGE_COMPLETED", {
      jobId: config.jobId,
      success: false,
      message,
      durationMs: completedAt.getTime() - startedAt.getTime(),
    });

    throw error;
  }
};

export class RestoreEngine {
  constructor(
    private readonly assetProvider: AssetRestoreProvider,
    private readonly deps: RestoreEngineDependencies
  ) {}

  run(config: RestoreConfig): Promise<RestoreEngineResult> {
    return executeRestore(config, this.assetProvider, this.deps);
  }
}

export const createRestoreEngine = (
  assetProvider: AssetRestoreProvider,
  deps: RestoreEngineDependencies
): RestoreEngine => new RestoreEngine(assetProvider, deps);

export const createProductionRestoreEngine = (): RestoreEngine =>
  createRestoreEngine(createDefaultAssetRestoreProvider(), createDefaultRestoreEngineDependencies());

