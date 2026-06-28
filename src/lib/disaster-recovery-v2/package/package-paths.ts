import { join } from "path";

import { BACKUP_ZIP_FILE_NAME } from "@/lib/disaster-recovery-v2/package/package-manifest-types";

export const resolvePackageRootDir = (workspaceDir: string): string =>
  join(workspaceDir, "package");

export const resolveBackupZipPath = (workspaceDir: string): string =>
  join(resolvePackageRootDir(workspaceDir), BACKUP_ZIP_FILE_NAME);

export const resolveBackupZipTempPath = (workspaceDir: string): string =>
  `${resolveBackupZipPath(workspaceDir)}.tmp`;

export const resolvePackageManifestPath = (workspaceDir: string): string =>
  join(workspaceDir, "metadata", "manifest.json");

export const resolveEmbeddedPackageManifestPath = (workspaceDir: string): string =>
  join(workspaceDir, "metadata", "manifest.embedded.json");

export const toMetadataZipPath = (fileName: string): string => `metadata/${fileName}`;

export const toDatabaseZipPath = (relativePath: string): string => `database/${relativePath}`;

export const toAssetsZipPath = (relativePath: string): string => `assets/${relativePath}`;
