import { mkdir, readFile, stat, writeFile } from "fs/promises";
import { dirname } from "path";

import { computeFileSha256 } from "@/lib/disaster-recovery-v2/database/hash-file";
import { resolveBackupZipPath } from "@/lib/disaster-recovery-v2/package/package-paths";
import { BACKUP_ZIP_FILE_NAME } from "@/lib/disaster-recovery-v2/package/package-manifest-types";
import type { PackageManifest } from "@/lib/disaster-recovery-v2/package/package-manifest-types";
import { resolvePackageManifestPath } from "@/lib/disaster-recovery-v2/package/package-paths";
import { createR2BackupUploadProvider } from "@/lib/disaster-recovery-v2/upload/providers/r2-upload-provider";
import type { BackupUploadProvider } from "@/lib/disaster-recovery-v2/upload/upload-provider";

export type UploadDependencies = {
  readPackageManifest: (manifestPath: string) => Promise<PackageManifest>;
  statFile: (filePath: string) => Promise<{ size: number }>;
  computeSha256: (filePath: string) => Promise<string>;
  writeUploadReport: (reportPath: string, report: unknown) => Promise<void>;
  sleep: (durationMs: number) => Promise<void>;
};

export const createDefaultUploadDependencies = (): UploadDependencies => ({
  readPackageManifest: async (manifestPath) => {
    const raw = await readFile(manifestPath, "utf8");
    return JSON.parse(raw) as PackageManifest;
  },
  statFile: async (filePath) => stat(filePath),
  computeSha256: computeFileSha256,
  writeUploadReport: async (reportPath, report) => {
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  },
  sleep: async (durationMs) => {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, durationMs);
    });
  },
});

export const createDefaultUploadProvider = (): BackupUploadProvider =>
  createR2BackupUploadProvider();

export const resolveUploadInputPaths = (workspaceDir: string) => ({
  backupZipPath: resolveBackupZipPath(workspaceDir),
  packageManifestPath: resolvePackageManifestPath(workspaceDir),
  backupZipFileName: BACKUP_ZIP_FILE_NAME,
});
