import type { PackageBuildDependencies } from "@/lib/disaster-recovery-v2/package/package-build-dependencies";
import { resolvePackageBuildPaths } from "@/lib/disaster-recovery-v2/package/package-build-dependencies";
import { createPackageBuildStage } from "@/lib/disaster-recovery-v2/package/create-package-build-stage";
import type { PackageBuildStage } from "@/lib/disaster-recovery-v2/package/package-build-stage";
import { PACKAGE_BUILD_STAGE_ID } from "@/lib/disaster-recovery-v2/package/package-build-stage";
import { discoverR2ObjectsFromDatabaseExport } from "@/lib/disaster-recovery-v2/object-storage/r2-discovery";
import {
  buildR2Manifest,
  R2_MANIFEST_ZIP_PATH,
  resolveR2ManifestWorkspacePath,
} from "@/lib/disaster-recovery-v2/object-storage/r2-manifest";
import {
  exportR2ObjectsFromManifest,
  verifyR2ManifestExport,
} from "@/lib/disaster-recovery-v2/object-storage/r2-export";
import type { BackupContext } from "@/lib/disaster-recovery-v2/types/backup-context";
import { createStageResult } from "@/lib/disaster-recovery-v2/types/stage-result";
import { logDrV2 } from "@/lib/disaster-recovery-v2/utils/logging";
import { getR2BucketName } from "@/lib/r2";

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const augmentPackageBuildDependenciesForR2 = (
  deps: PackageBuildDependencies
): PackageBuildDependencies => ({
  ...deps,
  collectEntries: async (input) => {
    const entries = await deps.collectEntries(input);
    const r2ManifestPath = resolveR2ManifestWorkspacePath(input.workspaceDir);

    if (!(await deps.entryCollector.pathExists(r2ManifestPath))) {
      return entries;
    }

    if (entries.some((entry) => entry.zipPath === R2_MANIFEST_ZIP_PATH)) {
      return entries;
    }

    return [
      ...entries,
      {
        section: "metadata" as const,
        zipPath: R2_MANIFEST_ZIP_PATH,
        sourcePath: r2ManifestPath,
      },
    ];
  },
});

export const executeR2ObjectExportStage = async (
  context: BackupContext,
  deps: PackageBuildDependencies
): Promise<void> => {
  const { workspaceDir, jobId } = context.config;
  const resolvedPaths = resolvePackageBuildPaths(workspaceDir);

  logDrV2("R2_EXPORT_STARTED", { jobId });

  const discovered = await discoverR2ObjectsFromDatabaseExport({
    collectionsDir: resolvedPaths.databaseCollectionsDir,
    defaultBucket: getR2BucketName(),
  });

  if (discovered.length === 0) {
    logDrV2("R2_EXPORT_SKIPPED", { jobId, reason: "NO_R2_REFERENCES" });
    context.artifacts.r2Export = {
      skipped: true,
      objectCount: 0,
      exported: 0,
      failed: 0,
      totalBytes: 0,
    };
    return;
  }

  const initialManifest = buildR2Manifest(discovered);
  const manifestPath = resolveR2ManifestWorkspacePath(workspaceDir);
  await deps.ensureDirectory(resolvedPaths.metadataRootDir);
  await deps.writeJsonFile(manifestPath, initialManifest);

  const exportResult = await exportR2ObjectsFromManifest(initialManifest, {
    workspaceDir,
    jobId,
  });

  await deps.writeJsonFile(manifestPath, exportResult.manifest);
  verifyR2ManifestExport(exportResult.manifest);

  context.artifacts.r2Export = {
    skipped: false,
    objectCount: exportResult.manifest.objectCount,
    exported: exportResult.exported,
    failed: exportResult.failed,
    totalBytes: exportResult.totalBytes,
    verified: exportResult.manifest.verified,
    manifestPath,
  };

  logDrV2("R2_OBJECTS_VERIFIED", {
    jobId,
    objectCount: exportResult.exported,
    totalBytes: exportResult.totalBytes,
    failed: exportResult.failed,
  });
};

export const createPackageBuildStageWithR2Export = (
  deps: PackageBuildDependencies
): PackageBuildStage => {
  const augmentedDeps = augmentPackageBuildDependenciesForR2(deps);
  const innerStage = createPackageBuildStage(augmentedDeps);

  return {
    id: PACKAGE_BUILD_STAGE_ID,
    name: innerStage.name,
    execute: async (context) => {
      const stageStartedAt = new Date();

      try {
        await executeR2ObjectExportStage(context, deps);
        return await innerStage.execute(context);
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
          errors: [{ code: "R2_EXPORT_FAILED", message }],
        });
      }
    },
  };
};
