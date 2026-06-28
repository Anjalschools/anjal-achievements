import type { DatabaseExportDependencies } from "@/lib/disaster-recovery-v2/database/database-export-dependencies";
import {
  createEmptyDatabaseManifest,
  type DatabaseManifest,
} from "@/lib/disaster-recovery-v2/database/database-manifest-types";
import {
  resolveDatabaseCollectionsDir,
  resolveDatabaseManifestPath,
  resolveCollectionBsonPath,
  toManifestRelativeCollectionPath,
} from "@/lib/disaster-recovery-v2/database/database-paths";
import { discoverApplicationCollectionNames } from "@/lib/disaster-recovery-v2/database/discover-collections";
import { DATABASE_STAGE_ID, type DatabaseStage } from "@/lib/disaster-recovery-v2/database/database-stage";
import type { BackupContext } from "@/lib/disaster-recovery-v2/types/backup-context";
import { createStageResult } from "@/lib/disaster-recovery-v2/types/stage-result";
import { logDrV2 } from "@/lib/disaster-recovery-v2/utils/logging";

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const executeDatabaseStage = async (
  context: BackupContext,
  deps: DatabaseExportDependencies
): Promise<{
  manifest: DatabaseManifest;
  manifestPath: string;
  collectionsDir: string;
  stageStartedAt: Date;
}> => {
  const stageStartedAt = new Date();
  const { workspaceDir } = context.config;
  const collectionsDir = resolveDatabaseCollectionsDir(workspaceDir);
  const manifestPath = resolveDatabaseManifestPath(workspaceDir);

  await deps.ensureDirectory(collectionsDir);

  logDrV2("DATABASE_DISCOVERY_STARTED", { jobId: context.config.jobId });

  const collectionNames = await discoverApplicationCollectionNames(deps.listCollections);

  logDrV2("DATABASE_DISCOVERY_COMPLETED", {
    jobId: context.config.jobId,
    collectionCount: collectionNames.length,
  });

  const manifest = createEmptyDatabaseManifest();

  for (const collectionName of collectionNames) {
    const collectionStartedAt = Date.now();
    const outputPath = resolveCollectionBsonPath(workspaceDir, collectionName);

    logDrV2("DATABASE_COLLECTION_STARTED", {
      jobId: context.config.jobId,
      collectionName,
    });

    try {
      const exportResult = await deps.exportCollection({
        collectionName,
        outputPath,
      });

      manifest.database.exportedCollections.push({
        name: collectionName,
        documentCount: exportResult.documentCount,
        exportedFile: toManifestRelativeCollectionPath(collectionName),
        sha256: exportResult.sha256,
        sizeBytes: exportResult.sizeBytes,
        durationMs: exportResult.durationMs,
      });

      logDrV2("DATABASE_COLLECTION_COMPLETED", {
        jobId: context.config.jobId,
        collectionName,
        documentCount: exportResult.documentCount,
        sizeBytes: exportResult.sizeBytes,
        durationMs: exportResult.durationMs,
      });
    } catch (error) {
      const message = toErrorMessage(error);
      manifest.database.failedCollections.push({
        name: collectionName,
        errorCode: "DATABASE_COLLECTION_EXPORT_FAILED",
        message,
        durationMs: Date.now() - collectionStartedAt,
      });

      logDrV2("DATABASE_COLLECTION_FAILED", {
        jobId: context.config.jobId,
        collectionName,
        message,
      });
    }
  }

  manifest.database.collectionCount =
    manifest.database.exportedCollections.length + manifest.database.failedCollections.length;
  manifest.database.documentCount = manifest.database.exportedCollections.reduce(
    (total, entry) => total + entry.documentCount,
    0
  );

  await deps.writeManifest(manifestPath, manifest);

  return {
    manifest,
    manifestPath,
    collectionsDir,
    stageStartedAt,
  };
};

export const createDatabaseStage = (deps: DatabaseExportDependencies): DatabaseStage => ({
  id: DATABASE_STAGE_ID,
  name: "Database Export",
  execute: async (context) => {
    const { manifest, manifestPath, collectionsDir, stageStartedAt } =
      await executeDatabaseStage(context, deps);

    const hasFailures = manifest.database.failedCollections.length > 0;

    context.artifacts.database = {
      manifestPath,
      collectionsDir,
      manifest,
    };

    const completedAt = new Date();

    logDrV2("DATABASE_STAGE_COMPLETED", {
      jobId: context.config.jobId,
      success: !hasFailures,
      exportedCollectionCount: manifest.database.exportedCollections.length,
      failedCollectionCount: manifest.database.failedCollections.length,
      documentCount: manifest.database.documentCount,
      durationMs: completedAt.getTime() - stageStartedAt.getTime(),
    });

    return createStageResult({
      stageId: DATABASE_STAGE_ID,
      success: !hasFailures,
      startedAt: stageStartedAt,
      completedAt,
      errors: manifest.database.failedCollections.map((entry) => ({
        code: entry.errorCode,
        message: `${entry.name}: ${entry.message}`,
      })),
    });
  },
});
