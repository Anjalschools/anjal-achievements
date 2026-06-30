import { mkdir, readFile, stat, writeFile } from "fs/promises";
import { dirname, join } from "path";

import { computeFileSha256 } from "@/lib/disaster-recovery-v2/database/hash-file";
import type { DatabaseManifest } from "@/lib/disaster-recovery-v2/database/database-manifest-types";
import type { PackageManifest } from "@/lib/disaster-recovery-v2/package/package-manifest-types";
import type { StorageManifest } from "@/lib/disaster-recovery-v2/storage/storage-manifest-types";
import type { AssetRestoreProvider } from "@/lib/disaster-recovery-v2/restore/asset-restore-provider";
import {
  createUnzipperRestoreZipExtractor,
  type RestoreZipExtractor,
} from "@/lib/disaster-recovery-v2/restore/extract-restore-package";
import { createCloudinaryAssetRestoreProvider } from "@/lib/disaster-recovery-v2/restore/providers/cloudinary-asset-restore-provider";
import type { DatabaseCollectionRestorer } from "@/lib/disaster-recovery-v2/restore/restore-database-collections";
import type { R2RestoreResult } from "@/lib/disaster-recovery-v2/object-storage/r2-restore";
import type { RestoreAssetsDependencies } from "@/lib/disaster-recovery-v2/restore/restore-assets";
import type { RestoreDatabaseDependencies } from "@/lib/disaster-recovery-v2/restore/restore-database-collections";
import {
  type RestorePackageValidationDependencies,
  type RestoreZipReader,
} from "@/lib/disaster-recovery-v2/restore/validate-restore-package";

export type RestoreEngineDependencies = {
  validation: RestorePackageValidationDependencies;
  ensureDirectory: (directoryPath: string) => Promise<void>;
  extractor: RestoreZipExtractor;
  pathExists: (filePath: string) => Promise<boolean>;
  readFile: (filePath: string) => Promise<Buffer>;
  readJsonFile: <T>(filePath: string) => Promise<T>;
  writeRestoreReport: (reportPath: string, report: unknown) => Promise<void>;
  database: RestoreDatabaseDependencies;
  assets: RestoreAssetsDependencies;
  restoreR2Objects: (input: {
    extractedRootDir: string;
    jobId: string;
  }) => Promise<R2RestoreResult>;
};

const createDefaultPathExists = async (filePath: string): Promise<boolean> => {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
};

export const createInMemoryDatabaseRestorer = (): DatabaseCollectionRestorer => {
  const restored = new Map<string, Record<string, unknown>[]>();

  return {
    restoreCollection: async ({ collectionName, documents, mode }) => {
      if (mode === "replace") {
        restored.set(collectionName, documents);
        return;
      }

      const existing = restored.get(collectionName) ?? [];
      const merged = new Map<string, Record<string, unknown>>();
      for (const document of existing) {
        merged.set(String(document._id), document);
      }
      for (const document of documents) {
        merged.set(String(document._id), document);
      }
      restored.set(collectionName, [...merged.values()]);
    },
    getRestored: () => restored,
  } as DatabaseCollectionRestorer & {
    getRestored: () => Map<string, Record<string, unknown>[]>;
  };
};

export const createDefaultRestoreEngineDependencies = (input?: {
  restorer?: DatabaseCollectionRestorer;
}): RestoreEngineDependencies => ({
  validation: {
    statFile: async (filePath) => stat(filePath),
    computeSha256: computeFileSha256,
    readZipManifest: createUnzipperRestoreZipReader(),
  },
  ensureDirectory: async (directoryPath) => {
    await mkdir(directoryPath, { recursive: true });
  },
  extractor: createUnzipperRestoreZipExtractor(),
  pathExists: createDefaultPathExists,
  readFile: async (filePath) => readFile(filePath),
  readJsonFile: async (filePath) => JSON.parse(await readFile(filePath, "utf8")) as never,
  writeRestoreReport: async (reportPath, report) => {
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  },
  database: {
    readFile: async (filePath) => readFile(filePath),
    pathExists: createDefaultPathExists,
    readDatabaseManifest: async (manifestPath) =>
      JSON.parse(await readFile(manifestPath, "utf8")) as DatabaseManifest,
    restorer: input?.restorer ?? createInMemoryDatabaseRestorer(),
  },
  assets: {
    readStorageManifest: async (manifestPath) =>
      JSON.parse(await readFile(manifestPath, "utf8")) as StorageManifest,
    pathExists: createDefaultPathExists,
  },
  restoreR2Objects: async ({ extractedRootDir, jobId }) => {
    const r2ManifestPath = join(extractedRootDir, "metadata", "r2-manifest.json");
    if (!(await createDefaultPathExists(r2ManifestPath))) {
      return {
        skipped: true,
        restored: 0,
        failed: 0,
        skippedCount: 0,
        entries: [],
      };
    }

    const { executeR2ObjectRestoreStage } = await import(
      "@/lib/disaster-recovery-v2/package/dr-streaming-restore"
    );
    return executeR2ObjectRestoreStage({ extractedRootDir, jobId });
  },
});

export const createUnzipperRestoreZipReader = (): RestoreZipReader => ({
  readManifest: async (zipPath) => {
    const unzipper = (await import("unzipper")).default;
    const directory = await unzipper.Open.file(zipPath);
    const entry = directory.files.find((file) => file.path === "metadata/manifest.json");
    if (!entry) {
      throw new Error("RESTORE_PACKAGE_MANIFEST_MISSING");
    }
    return JSON.parse((await entry.buffer()).toString("utf8")) as PackageManifest;
  },
});

export const createDefaultAssetRestoreProvider = (): AssetRestoreProvider =>
  createCloudinaryAssetRestoreProvider();
