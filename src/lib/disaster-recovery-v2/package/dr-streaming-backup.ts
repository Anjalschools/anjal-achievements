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
import { persistV2ProductionProgress } from "@/lib/disaster-recovery-v2/production/v2-production-progress";
import {
  V2_PRODUCTION_JOB_PHASES,
  type V2ProductionJobPhase,
} from "@/lib/disaster-recovery-v2/production/v2-production-stage-mapping";
import {
  logMemorySnapshot,
  setV2MemoryDiagnosticsCurrentStage,
} from "@/lib/disaster-recovery-v2/diagnostics/v2-memory-diagnostics";

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const persistPackageBuildProgress = async (
  recordId: string,
  jobPhase: V2ProductionJobPhase,
  extra?: {
    processedObjects?: number;
    totalObjects?: number;
    bytesExported?: number;
  }
): Promise<void> => {
  await persistV2ProductionProgress(recordId, {
    jobPhase,
    ...extra,
  });
};

const trackPackageBuildSubPhase = (checkpoint: string, jobPhase: V2ProductionJobPhase): void => {
  setV2MemoryDiagnosticsCurrentStage(checkpoint);
  logMemorySnapshot(checkpoint, { jobPhase });
};

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
  const recordId = jobId;

  trackPackageBuildSubPhase("R2_DISCOVERY_START", V2_PRODUCTION_JOB_PHASES.R2_DISCOVERY);
  await persistPackageBuildProgress(recordId, V2_PRODUCTION_JOB_PHASES.R2_DISCOVERY);

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

  trackPackageBuildSubPhase("R2_EXPORT_START", V2_PRODUCTION_JOB_PHASES.R2_EXPORT);
  await persistPackageBuildProgress(recordId, V2_PRODUCTION_JOB_PHASES.R2_EXPORT, {
    totalObjects: initialManifest.objectCount,
    processedObjects: 0,
  });

  const exportResult = await exportR2ObjectsFromManifest(initialManifest, {
    workspaceDir,
    jobId,
  });

  await deps.writeJsonFile(manifestPath, exportResult.manifest);

  trackPackageBuildSubPhase("R2_VERIFICATION_START", V2_PRODUCTION_JOB_PHASES.R2_VERIFICATION);
  await persistPackageBuildProgress(recordId, V2_PRODUCTION_JOB_PHASES.R2_VERIFICATION, {
    totalObjects: exportResult.manifest.objectCount,
    processedObjects: exportResult.exported,
    bytesExported: exportResult.totalBytes,
  });

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

        trackPackageBuildSubPhase("PACKAGE_BUILD_START", V2_PRODUCTION_JOB_PHASES.PACKAGE_BUILD);
        await persistPackageBuildProgress(
          context.config.jobId,
          V2_PRODUCTION_JOB_PHASES.PACKAGE_BUILD
        );

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
