import { buildEmbeddedPackageManifest, buildPackageManifest } from "@/lib/disaster-recovery-v2/package/build-package-manifest";
import { collectPackageZipEntries, sortPackageZipEntries } from "@/lib/disaster-recovery-v2/package/collect-package-entries";
import { createBackupZip } from "@/lib/disaster-recovery-v2/package/create-backup-zip";
import type { PackageBuildDependencies } from "@/lib/disaster-recovery-v2/package/package-build-dependencies";
import { resolvePackageBuildPaths } from "@/lib/disaster-recovery-v2/package/package-build-dependencies";
import type { PackageManifest } from "@/lib/disaster-recovery-v2/package/package-manifest-types";
import {
  resolveBackupZipPath,
  resolveBackupZipTempPath,
  resolveEmbeddedPackageManifestPath,
  resolvePackageManifestPath,
  resolvePackageRootDir,
} from "@/lib/disaster-recovery-v2/package/package-paths";
import {
  PACKAGE_BUILD_STAGE_ID,
  type PackageBuildStage,
} from "@/lib/disaster-recovery-v2/package/package-build-stage";
import { verifyBackupZip } from "@/lib/disaster-recovery-v2/package/verify-backup-zip";
import type { AssetDownloadReport } from "@/lib/disaster-recovery-v2/storage/asset-download/asset-download-report-types";
import type { DatabaseManifest } from "@/lib/disaster-recovery-v2/database/database-manifest-types";
import type { StorageManifest } from "@/lib/disaster-recovery-v2/storage/storage-manifest-types";
import type { BackupContext } from "@/lib/disaster-recovery-v2/types/backup-context";
import { createStageResult } from "@/lib/disaster-recovery-v2/types/stage-result";
import { logDrV2 } from "@/lib/disaster-recovery-v2/utils/logging";

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const writeEmbeddedPackageManifest = async (
  deps: PackageBuildDependencies,
  workspaceDir: string,
  manifest: PackageManifest
): Promise<void> => {
  await deps.writeJsonFile(
    resolveEmbeddedPackageManifestPath(workspaceDir),
    buildEmbeddedPackageManifest(manifest)
  );
};

const validateEntriesReadable = async (
  entries: Awaited<ReturnType<typeof collectPackageZipEntries>>,
  validateSourceReadable: PackageBuildDependencies["validateSourceReadable"]
): Promise<void> => {
  for (const entry of entries) {
    try {
      await validateSourceReadable(entry.sourcePath);
    } catch (error) {
      throw new Error(
        `PACKAGE_SOURCE_UNREADABLE:${entry.sourcePath}:${toErrorMessage(error)}`
      );
    }
  }
};

export const executePackageBuildStage = async (
  context: BackupContext,
  deps: PackageBuildDependencies
): Promise<{
  manifest: PackageManifest;
  manifestPath: string;
  zipPath: string;
  packageRootDir: string;
  stageStartedAt: Date;
}> => {
  const stageStartedAt = new Date();
  const { workspaceDir, jobId } = context.config;
  const packageRootDir = resolvePackageRootDir(workspaceDir);
  const zipPath = resolveBackupZipPath(workspaceDir);
  const zipTempPath = resolveBackupZipTempPath(workspaceDir);
  const manifestPath = resolvePackageManifestPath(workspaceDir);
  const resolvedPaths = resolvePackageBuildPaths(workspaceDir);

  await deps.ensureDirectory(packageRootDir);
  await deps.ensureDirectory(resolvedPaths.metadataRootDir);
  await deps.removeFile(zipPath).catch(() => undefined);
  await deps.removeFile(zipTempPath).catch(() => undefined);

  const payloadEntries = sortPackageZipEntries(
    await deps.collectEntries({
      workspaceDir,
      collector: deps.entryCollector,
      resolvePaths: resolvedPaths,
      includePackageManifest: false,
    })
  );

  await validateEntriesReadable(payloadEntries, deps.validateSourceReadable);

  const databaseManifest = await deps.readJsonFile<DatabaseManifest>(resolvedPaths.databaseManifestPath);
  const storageManifest = await deps.readJsonFile<StorageManifest>(resolvedPaths.storageManifestPath);
  const assetDownloadReport = await deps.readJsonFile<AssetDownloadReport>(
    resolvedPaths.assetDownloadReportPath
  );

  let packageManifest = buildPackageManifest({
    databaseManifest,
    storageManifest,
    assetDownloadReport,
    packageSummary: {
      size: 0,
      sha256: "",
      entryCount: payloadEntries.length,
    },
    verification: {
      verified: false,
      entryCount: payloadEntries.length,
      sha256: "",
    },
  });

  await deps.writeJsonFile(manifestPath, packageManifest);
  await writeEmbeddedPackageManifest(deps, workspaceDir, packageManifest);

  const finalEntries = sortPackageZipEntries(
    await deps.collectEntries({
      workspaceDir,
      collector: deps.entryCollector,
      resolvePaths: resolvedPaths,
      includePackageManifest: true,
    })
  );

  await validateEntriesReadable(finalEntries, deps.validateSourceReadable);

  try {
    await createBackupZip({
      outputPath: zipTempPath,
      entries: finalEntries,
      jobId,
      createZipWriter: deps.createZipWriter,
    });

    const verification = await verifyBackupZip({
      zipPath: zipTempPath,
      expectedEntryCount: finalEntries.length,
      statFile: deps.statFile,
      computeSha256: deps.computeSha256,
      readZipEntries: deps.readZipEntries,
    });

    packageManifest = buildPackageManifest({
      databaseManifest,
      storageManifest,
      assetDownloadReport,
      packageSummary: {
        size: verification.sizeBytes,
        sha256: verification.sha256,
        entryCount: verification.entryCount,
      },
      verification: {
        verified: true,
        entryCount: verification.entryCount,
        sha256: verification.sha256,
      },
    });

    await deps.writeJsonFile(manifestPath, packageManifest);
    await writeEmbeddedPackageManifest(deps, workspaceDir, packageManifest);

    const verifiedEntries = sortPackageZipEntries(
      await deps.collectEntries({
        workspaceDir,
        collector: deps.entryCollector,
        resolvePaths: resolvedPaths,
        includePackageManifest: true,
      })
    );

    await validateEntriesReadable(verifiedEntries, deps.validateSourceReadable);
    await deps.removeFile(zipTempPath).catch(() => undefined);
    await createBackupZip({
      outputPath: zipTempPath,
      entries: verifiedEntries,
      jobId,
      createZipWriter: deps.createZipWriter,
    });

    const finalVerification = await verifyBackupZip({
      zipPath: zipTempPath,
      expectedEntryCount: verifiedEntries.length,
      statFile: deps.statFile,
      computeSha256: deps.computeSha256,
      readZipEntries: deps.readZipEntries,
    });

    packageManifest = buildPackageManifest({
      databaseManifest,
      storageManifest,
      assetDownloadReport,
      packageSummary: {
        size: finalVerification.sizeBytes,
        sha256: finalVerification.sha256,
        entryCount: finalVerification.entryCount,
      },
      verification: {
        verified: true,
        entryCount: finalVerification.entryCount,
        sha256: finalVerification.sha256,
      },
    });

    await deps.writeJsonFile(manifestPath, packageManifest);
    await deps.renameFile(zipTempPath, zipPath);

    logDrV2("PACKAGE_VERIFIED", {
      jobId,
      zipPath,
      sizeBytes: finalVerification.sizeBytes,
      entryCount: finalVerification.entryCount,
      sha256: finalVerification.sha256,
    });

    return {
      manifest: packageManifest,
      manifestPath,
      zipPath,
      packageRootDir,
      stageStartedAt,
    };
  } catch (error) {
    await deps.removeFile(zipTempPath).catch(() => undefined);
    await deps.removeFile(zipPath).catch(() => undefined);
    throw error;
  }
};

export const createPackageBuildStage = (deps: PackageBuildDependencies): PackageBuildStage => ({
  id: PACKAGE_BUILD_STAGE_ID,
  name: "Package Build",
  execute: async (context) => {
    const stageStartedAt = new Date();

    try {
      const result = await executePackageBuildStage(context, deps);
      const completedAt = new Date();

      context.artifacts.packageBuild = {
        manifestPath: result.manifestPath,
        zipPath: result.zipPath,
        packageRootDir: result.packageRootDir,
        manifest: result.manifest,
      };

      logDrV2("PACKAGE_STAGE_COMPLETED", {
        jobId: context.config.jobId,
        success: true,
        zipPath: result.zipPath,
        entryCount: result.manifest.package.entryCount,
        sizeBytes: result.manifest.package.size,
        durationMs: completedAt.getTime() - stageStartedAt.getTime(),
      });

      return createStageResult({
        stageId: PACKAGE_BUILD_STAGE_ID,
        success: true,
        startedAt: stageStartedAt,
        completedAt,
      });
    } catch (error) {
      const message = toErrorMessage(error);
      const completedAt = new Date();

      logDrV2("PACKAGE_STAGE_COMPLETED", {
        jobId: context.config.jobId,
        success: false,
        message,
        durationMs: completedAt.getTime() - stageStartedAt.getTime(),
      });

      return createStageResult({
        stageId: PACKAGE_BUILD_STAGE_ID,
        success: false,
        startedAt: stageStartedAt,
        completedAt,
        errors: [{ code: "PACKAGE_BUILD_FAILED", message }],
      });
    }
  },
});
