import type { DatabaseManifest } from "@/lib/disaster-recovery-v2/database/database-manifest-types";
import type { RestoreMode } from "@/lib/disaster-recovery-v2/restore/restore-config";
import { parseBsonCollectionFile } from "@/lib/disaster-recovery-v2/restore/parse-bson-collection";
import type { RestoreCollectionResult } from "@/lib/disaster-recovery-v2/restore/restore-report-types";
import { resolveExtractedDatabaseCollectionPath } from "@/lib/disaster-recovery-v2/restore/restore-paths";
import type { RestoreContext } from "@/lib/disaster-recovery-v2/restore/restore-context";
import { logDrV2 } from "@/lib/disaster-recovery-v2/utils/logging";

export type DatabaseCollectionRestorer = {
  restoreCollection: (input: {
    collectionName: string;
    documents: Record<string, unknown>[];
    mode: RestoreMode;
  }) => Promise<void>;
};

export type RestoreDatabaseDependencies = {
  readFile: (filePath: string) => Promise<Buffer>;
  pathExists: (filePath: string) => Promise<boolean>;
  readDatabaseManifest: (manifestPath: string) => Promise<DatabaseManifest>;
  restorer: DatabaseCollectionRestorer;
};

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const restoreDatabaseCollections = async (input: {
  context: RestoreContext;
  extractedRootDir: string;
  databaseManifestPath: string;
  deps: RestoreDatabaseDependencies;
}): Promise<RestoreCollectionResult[]> => {
  const databaseManifest = await input.deps.readDatabaseManifest(input.databaseManifestPath);
  const collectionNames = databaseManifest.database.exportedCollections
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  const results: RestoreCollectionResult[] = [];

  for (const collectionName of collectionNames) {
    const startedAt = Date.now();
    const collectionPath = resolveExtractedDatabaseCollectionPath(
      input.extractedRootDir,
      collectionName
    );

    try {
      if (!(await input.deps.pathExists(collectionPath))) {
        throw new Error(`RESTORE_COLLECTION_FILE_MISSING:${collectionName}`);
      }

      const content = await input.deps.readFile(collectionPath);
      const documents = parseBsonCollectionFile(content);

      await input.deps.restorer.restoreCollection({
        collectionName,
        documents,
        mode: input.context.config.restoreMode ?? "replace",
      });

      results.push({
        name: collectionName,
        status: "restored",
        documentCount: documents.length,
        durationMs: Date.now() - startedAt,
      });

      logDrV2("DATABASE_COLLECTION_RESTORED", {
        jobId: input.context.config.jobId,
        collectionName,
        documentCount: documents.length,
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      const message = toErrorMessage(error);
      results.push({
        name: collectionName,
        status: "failed",
        documentCount: 0,
        durationMs: Date.now() - startedAt,
        error: message,
      });
    }
  }

  return results;
};
