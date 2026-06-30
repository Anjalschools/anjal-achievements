import { buildEmbeddedPackageManifest, buildPackageManifest } from "@/lib/disaster-recovery-v2/package/build-package-manifest";
import {
  collectPackageZipEntries,
  sortPackageZipEntries,
  type PackageZipEntry,
} from "@/lib/disaster-recovery-v2/package/collect-package-entries";
import { createBackupZip } from "@/lib/disaster-recovery-v2/package/create-backup-zip";
import type { PackageBuildDependencies } from "@/lib/disaster-recovery-v2/package/package-build-dependencies";
import { resolvePackageBuildPaths } from "@/lib/disaster-recovery-v2/package/package-build-dependencies";
import type { PackageManifest } from "@/lib/disaster-recovery-v2/package/package-manifest-types";
import {
  parseR2Manifest,
  summarizeR2ManifestForPackage,
  type R2Manifest,
} from "@/lib/disaster-recovery-v2/object-storage/r2-manifest";
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

const getMemoryDiagnostics = (): {
  rss: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
} => {
  const memory = process.memoryUsage();
  return {
    rss: memory.rss,
    heapUsed: memory.heapUsed,
    heapTotal: memory.heapTotal,
    external: memory.external,
    arrayBuffers: memory.arrayBuffers,
  };
};

const extractPackageBuildErrorDiagnostics = (error: unknown): {
  errorName: string;
  errorMessage: string;
  errorCode?: string;
  stack?: string;
} => {
  const record =
    error && typeof error === "object" ? (error as Record<string, unknown>) : undefined;
  const errorCode = typeof record?.code === "string" ? record.code : undefined;

  return {
    errorName: error instanceof Error ? error.name : "Error",
    errorMessage: toErrorMessage(error),
    errorCode,
    stack: error instanceof Error ? error.stack : undefined,
  };
};

const summarizePackageEntries = (entries: PackageZipEntry[]): {
  totalEntries: number;
  databaseEntries: number;
  cloudinaryEntries: number;
  r2Entries: number;
  metadataEntries: number;
  otherEntries: number;
} => {
  let databaseEntries = 0;
  let cloudinaryEntries = 0;
  let r2Entries = 0;
  let metadataEntries = 0;
  let otherEntries = 0;

  for (const entry of entries) {
    if (entry.section === "database") {
      databaseEntries += 1;
      continue;
    }

    if (entry.section === "metadata") {
      metadataEntries += 1;
      continue;
    }

    if (entry.zipPath.startsWith("assets/r2/")) {
      r2Entries += 1;
      continue;
    }

    if (entry.zipPath.startsWith("assets/cloudinary/")) {
      cloudinaryEntries += 1;
      continue;
    }

    otherEntries += 1;
  }

  return {
    totalEntries: entries.length,
    databaseEntries,
    cloudinaryEntries,
    r2Entries,
    metadataEntries,
    otherEntries,
  };
};

const logPackageBuildFailure = (input: {
  jobId: string;
  currentStep: string;
  error: unknown;
  durationMs: number;
}): void => {
  const errorDiagnostics = extractPackageBuildErrorDiagnostics(input.error);

  logDrV2("PACKAGE_BUILD_FAILED", {
    jobId: input.jobId,
    currentStep: input.currentStep,
    durationMs: input.durationMs,
    memory: getMemoryDiagnostics(),
    ...errorDiagnostics,
  });
};

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

const loadObjectStorageSummary = async (
  deps: PackageBuildDependencies,
  r2ManifestPath: string
) => {
  const raw = await deps.readJsonFile<R2Manifest>(r2ManifestPath);
  return summarizeR2ManifestForPackage(parseR2Manifest(raw));
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

const collectEntriesWithDiagnostics = async (input: {
  jobId: string;
  phase: string;
  deps: PackageBuildDependencies;
  workspaceDir: string;
  resolvedPaths: ReturnType<typeof resolvePackageBuildPaths>;
  includePackageManifest: boolean;
}): Promise<PackageZipEntry[]> => {
  const startedAt = Date.now();
  const memoryBefore = getMemoryDiagnostics();

  logDrV2("PACKAGE_BUILD_COLLECT_ENTRIES_STARTED", {
    jobId: input.jobId,
    phase: input.phase,
    timestamp: new Date().toISOString(),
    memoryBefore,
    memory: memoryBefore,
  });

  const entries = sortPackageZipEntries(
    await input.deps.collectEntries({
      workspaceDir: input.workspaceDir,
      collector: input.deps.entryCollector,
      resolvePaths: input.resolvedPaths,
      includePackageManifest: input.includePackageManifest,
    })
  );

  const durationMs = Date.now() - startedAt;
  const memoryAfter = getMemoryDiagnostics();

  logDrV2("PACKAGE_BUILD_COLLECT_ENTRIES_COMPLETED", {
    jobId: input.jobId,
    phase: input.phase,
    entryCount: entries.length,
    durationMs,
    memoryBefore,
    memoryAfter,
    memory: memoryAfter,
  });

  logDrV2("PACKAGE_BUILD_ENTRY_SUMMARY", {
    jobId: input.jobId,
    phase: input.phase,
    ...summarizePackageEntries(entries),
    memoryBefore,
    memoryAfter,
    memory: memoryAfter,
  });

  return entries;
};

const createZipWithDiagnostics = async (input: {
  jobId: string;
  phase: string;
  outputPath: string;
  entries: PackageZipEntry[];
  deps: PackageBuildDependencies;
}): Promise<void> => {
  const startedAt = Date.now();
  const memoryBefore = getMemoryDiagnostics();

  logDrV2("PACKAGE_BUILD_CREATE_ZIP_STARTED", {
    jobId: input.jobId,
    phase: input.phase,
    zipPath: input.outputPath,
    entryCount: input.entries.length,
    timestamp: new Date().toISOString(),
    memoryBefore,
    memory: memoryBefore,
  });

  await createBackupZip({
    outputPath: input.outputPath,
    entries: input.entries,
    jobId: input.jobId,
    createZipWriter: input.deps.createZipWriter,
  });

  let zipExists = false;
  let zipSizeBytes: number | undefined;
  try {
    const zipStat = await input.deps.statFile(input.outputPath);
    zipExists = true;
    zipSizeBytes = zipStat.size;
  } catch {
    zipExists = false;
  }

  const durationMs = Date.now() - startedAt;
  const memoryAfter = getMemoryDiagnostics();

  logDrV2("PACKAGE_BUILD_CREATE_ZIP_COMPLETED", {
    jobId: input.jobId,
    phase: input.phase,
    durationMs,
    zipPath: input.outputPath,
    zipExists,
    zipSizeBytes,
    memoryBefore,
    memoryAfter,
    memory: memoryAfter,
  });
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
  const stageStartedAtMs = stageStartedAt.getTime();
  const { workspaceDir, jobId } = context.config;
  const packageRootDir = resolvePackageRootDir(workspaceDir);
  const zipPath = resolveBackupZipPath(workspaceDir);
  const zipTempPath = resolveBackupZipTempPath(workspaceDir);
  const manifestPath = resolvePackageManifestPath(workspaceDir);
  const resolvedPaths = resolvePackageBuildPaths(workspaceDir);
  let currentStep = "started";

  logDrV2("PACKAGE_BUILD_STARTED", {
    jobId,
    workspaceDir,
    timestamp: stageStartedAt.toISOString(),
    memory: getMemoryDiagnostics(),
  });

  try {
    currentStep = "prepare-workspace";
    await deps.ensureDirectory(packageRootDir);
    await deps.ensureDirectory(resolvedPaths.metadataRootDir);
    await deps.removeFile(zipPath).catch(() => undefined);
    await deps.removeFile(zipTempPath).catch(() => undefined);

    currentStep = "collect-entries-payload";
    const payloadEntries = await collectEntriesWithDiagnostics({
      jobId,
      phase: "payload",
      deps,
      workspaceDir,
      resolvedPaths,
      includePackageManifest: false,
    });

    currentStep = "validate-payload-entries";
    await validateEntriesReadable(payloadEntries, deps.validateSourceReadable);

    currentStep = "load-manifests";
    const databaseManifest = await deps.readJsonFile<DatabaseManifest>(resolvedPaths.databaseManifestPath);
    const storageManifest = await deps.readJsonFile<StorageManifest>(resolvedPaths.storageManifestPath);
    const assetDownloadReport = await deps.readJsonFile<AssetDownloadReport>(
      resolvedPaths.assetDownloadReportPath
    );
    const objectStorage = await loadObjectStorageSummary(deps, resolvedPaths.r2ManifestPath);

    currentStep = "write-initial-manifest";
    let packageManifest = buildPackageManifest({
      databaseManifest,
      storageManifest,
      assetDownloadReport,
      objectStorage,
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

    currentStep = "collect-entries-final";
    const finalEntries = await collectEntriesWithDiagnostics({
      jobId,
      phase: "final",
      deps,
      workspaceDir,
      resolvedPaths,
      includePackageManifest: true,
    });

    currentStep = "validate-final-entries";
    await validateEntriesReadable(finalEntries, deps.validateSourceReadable);

    currentStep = "create-zip-initial";
    await createZipWithDiagnostics({
      jobId,
      phase: "initial",
      outputPath: zipTempPath,
      entries: finalEntries,
      deps,
    });

    currentStep = "verify-zip-initial";
    const verification = await verifyBackupZip({
      zipPath: zipTempPath,
      expectedEntryCount: finalEntries.length,
      statFile: deps.statFile,
      computeSha256: deps.computeSha256,
      readZipEntries: deps.readZipEntries,
    });

    currentStep = "write-verified-manifest";
    packageManifest = buildPackageManifest({
      databaseManifest,
      storageManifest,
      assetDownloadReport,
      objectStorage,
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

    currentStep = "collect-entries-verified";
    const verifiedEntries = await collectEntriesWithDiagnostics({
      jobId,
      phase: "verified",
      deps,
      workspaceDir,
      resolvedPaths,
      includePackageManifest: true,
    });

    currentStep = "validate-verified-entries";
    await validateEntriesReadable(verifiedEntries, deps.validateSourceReadable);
    await deps.removeFile(zipTempPath).catch(() => undefined);

    currentStep = "create-zip-final";
    await createZipWithDiagnostics({
      jobId,
      phase: "final",
      outputPath: zipTempPath,
      entries: verifiedEntries,
      deps,
    });

    currentStep = "verify-zip-final";
    const finalVerification = await verifyBackupZip({
      zipPath: zipTempPath,
      expectedEntryCount: verifiedEntries.length,
      statFile: deps.statFile,
      computeSha256: deps.computeSha256,
      readZipEntries: deps.readZipEntries,
    });

    currentStep = "write-final-manifest";
    packageManifest = buildPackageManifest({
      databaseManifest,
      storageManifest,
      assetDownloadReport,
      objectStorage,
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
    currentStep = "finalize-zip";
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
    logPackageBuildFailure({
      jobId,
      currentStep,
      error,
      durationMs: Date.now() - stageStartedAtMs,
    });

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
    const stageStartedAtMs = stageStartedAt.getTime();

    try {
      const result = await executePackageBuildStage(context, deps);
      const completedAt = new Date();
      const totalDurationMs = completedAt.getTime() - stageStartedAtMs;

      context.artifacts.packageBuild = {
        manifestPath: result.manifestPath,
        zipPath: result.zipPath,
        packageRootDir: result.packageRootDir,
        manifest: result.manifest,
      };

      logDrV2("PACKAGE_BUILD_COMPLETED", {
        jobId: context.config.jobId,
        totalDurationMs,
        entryCount: result.manifest.package.entryCount,
        zipSizeBytes: result.manifest.package.size,
        success: true,
        memory: getMemoryDiagnostics(),
      });

      logDrV2("PACKAGE_STAGE_COMPLETED", {
        jobId: context.config.jobId,
        success: true,
        zipPath: result.zipPath,
        entryCount: result.manifest.package.entryCount,
        sizeBytes: result.manifest.package.size,
        durationMs: totalDurationMs,
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
      const totalDurationMs = completedAt.getTime() - stageStartedAtMs;

      logDrV2("PACKAGE_STAGE_COMPLETED", {
        jobId: context.config.jobId,
        success: false,
        message,
        durationMs: totalDurationMs,
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
