import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "fs/promises";
import { join } from "path";

import { computeFileSha256 } from "@/lib/disaster-recovery-v2/database/hash-file";
import { resolveDatabaseCollectionsDir, resolveDatabaseManifestPath } from "@/lib/disaster-recovery-v2/database/database-paths";
import {
  collectPackageZipEntries,
  type PackageZipEntryCollector,
} from "@/lib/disaster-recovery-v2/package/collect-package-entries";
import {
  createArchiverZipWriterFactory,
  type ZipArchiveWriterFactory,
} from "@/lib/disaster-recovery-v2/package/create-backup-zip";
import {
  createUnzipperBackupZipReader,
  type BackupZipReader,
} from "@/lib/disaster-recovery-v2/package/verify-backup-zip";
import {
  resolveAssetDownloadReportPath,
  resolveAssetsRootDir,
  resolveMetadataRootDir,
  resolveMissingAssetsPath,
} from "@/lib/disaster-recovery-v2/storage/asset-download/asset-download-paths";
import { resolveStorageManifestPath } from "@/lib/disaster-recovery-v2/storage/storage-paths";
import { resolvePackageManifestPath } from "@/lib/disaster-recovery-v2/package/package-paths";

export type PackageBuildDependencies = {
  ensureDirectory: (directoryPath: string) => Promise<void>;
  readJsonFile: <T>(filePath: string) => Promise<T | null>;
  writeJsonFile: (filePath: string, payload: unknown) => Promise<void>;
  removeFile: (filePath: string) => Promise<void>;
  renameFile: (sourcePath: string, destinationPath: string) => Promise<void>;
  statFile: (filePath: string) => Promise<{ size: number }>;
  computeSha256: (filePath: string) => Promise<string>;
  validateSourceReadable: (filePath: string) => Promise<void>;
  collectEntries: typeof collectPackageZipEntries;
  createZipWriter: ZipArchiveWriterFactory;
  readZipEntries: BackupZipReader;
  entryCollector: PackageZipEntryCollector;
};

const createDefaultEntryCollector = (): PackageZipEntryCollector => ({
  pathExists: async (filePath) => {
    try {
      await stat(filePath);
      return true;
    } catch {
      return false;
    }
  },
  listDirectory: async (directoryPath) => readdir(directoryPath),
  statFile: async (filePath) => {
    const fileStat = await stat(filePath);
    return {
      isFile: fileStat.isFile(),
      isDirectory: fileStat.isDirectory(),
    };
  },
});

export const createDefaultPackageBuildDependencies = (): PackageBuildDependencies => ({
  ensureDirectory: async (directoryPath) => {
    await mkdir(directoryPath, { recursive: true });
  },
  readJsonFile: async (filePath) => {
    try {
      const raw = await readFile(filePath, "utf8");
      return JSON.parse(raw) as unknown as ReturnType<PackageBuildDependencies["readJsonFile"]>;
    } catch {
      return null;
    }
  },
  writeJsonFile: async (filePath, payload) => {
    await mkdir(join(filePath, ".."), { recursive: true });
    await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  },
  removeFile: async (filePath) => {
    await rm(filePath, { force: true });
  },
  renameFile: async (sourcePath, destinationPath) => {
    await rename(sourcePath, destinationPath);
  },
  statFile: async (filePath) => stat(filePath),
  computeSha256: computeFileSha256,
  validateSourceReadable: async (filePath) => {
    await readFile(filePath);
  },
  collectEntries: collectPackageZipEntries,
  createZipWriter: createArchiverZipWriterFactory(),
  readZipEntries: createUnzipperBackupZipReader(),
  entryCollector: createDefaultEntryCollector(),
});

export const resolvePackageBuildPaths = (workspaceDir: string) => ({
  databaseManifestPath: resolveDatabaseManifestPath(workspaceDir),
  storageManifestPath: resolveStorageManifestPath(workspaceDir),
  assetDownloadReportPath: resolveAssetDownloadReportPath(workspaceDir),
  missingAssetsPath: resolveMissingAssetsPath(workspaceDir),
  databaseCollectionsDir: resolveDatabaseCollectionsDir(workspaceDir),
  assetsRootDir: resolveAssetsRootDir(workspaceDir),
  packageManifestPath: resolvePackageManifestPath(workspaceDir),
  metadataRootDir: resolveMetadataRootDir(workspaceDir),
});
