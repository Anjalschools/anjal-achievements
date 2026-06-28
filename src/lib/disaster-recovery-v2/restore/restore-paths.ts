import { join } from "path";

import { resolveBackupZipPath } from "@/lib/disaster-recovery-v2/package/package-paths";

export const resolveRestoreRootDir = (workspaceDir: string): string =>
  join(workspaceDir, "restore");

export const resolveRestoreReportPath = (workspaceDir: string): string =>
  join(resolveRestoreRootDir(workspaceDir), "restore-report.json");

export const resolveRestoreBackupZipPath = (
  workspaceDir: string,
  backupZipPath?: string
): string => backupZipPath ?? resolveBackupZipPath(workspaceDir);

export const resolveExtractedMetadataPath = (extractedRootDir: string, fileName: string): string =>
  join(extractedRootDir, "metadata", fileName);

export const resolveExtractedDatabaseCollectionPath = (
  extractedRootDir: string,
  collectionName: string
): string => join(extractedRootDir, "database", "collections", `${collectionName}.bson`);

export const resolveExtractedAssetPath = (extractedRootDir: string, relativeAssetPath: string): string =>
  join(extractedRootDir, relativeAssetPath);

export const REQUIRED_RESTORE_MANIFESTS = [
  "manifest.json",
  "database-manifest.json",
  "storage-manifest.json",
] as const;
