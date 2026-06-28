import { mkdir, readFile, rename, rm, stat, writeFile } from "fs/promises";
import { dirname } from "path";

import { computeFileSha256 } from "@/lib/disaster-recovery-v2/database/hash-file";
import { resolveStorageManifestPath } from "@/lib/disaster-recovery-v2/storage/storage-paths";
import type { StorageManifest } from "@/lib/disaster-recovery-v2/storage/storage-manifest-types";
import {
  createFetchAssetDownloadTransport,
  type AssetDownloadTransport,
} from "@/lib/disaster-recovery-v2/storage/asset-download/asset-download-transport";

export type AssetDownloadDependencies = {
  readStorageManifest: (manifestPath: string) => Promise<StorageManifest>;
  ensureDirectory: (directoryPath: string) => Promise<void>;
  writeJsonFile: (filePath: string, payload: unknown) => Promise<void>;
  transport: AssetDownloadTransport;
  renameFile: (sourcePath: string, destinationPath: string) => Promise<void>;
  removeFile: (filePath: string) => Promise<void>;
  statFile: (filePath: string) => Promise<{ size: number }>;
  computeSha256: (filePath: string) => Promise<string>;
  sleep: (durationMs: number) => Promise<void>;
};

export const createDefaultAssetDownloadDependencies = (): AssetDownloadDependencies => ({
  readStorageManifest: async (manifestPath) => {
    const raw = await readFile(manifestPath, "utf8");
    return JSON.parse(raw) as StorageManifest;
  },
  ensureDirectory: async (directoryPath) => {
    await mkdir(directoryPath, { recursive: true });
  },
  writeJsonFile: async (filePath, payload) => {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  },
  transport: createFetchAssetDownloadTransport(),
  renameFile: async (sourcePath, destinationPath) => {
    await rename(sourcePath, destinationPath);
  },
  removeFile: async (filePath) => {
    await rm(filePath, { force: true });
  },
  statFile: async (filePath) => stat(filePath),
  computeSha256: computeFileSha256,
  sleep: async (durationMs) => {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, durationMs);
    });
  },
});

export const resolveInputStorageManifestPath = (workspaceDir: string): string =>
  resolveStorageManifestPath(workspaceDir);
