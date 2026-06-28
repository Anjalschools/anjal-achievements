import { join } from "path";

export const resolveMetadataRootDir = (workspaceDir: string): string =>
  join(workspaceDir, "metadata");

export const resolveAssetDownloadReportPath = (workspaceDir: string): string =>
  join(resolveMetadataRootDir(workspaceDir), "asset-download-report.json");

export const resolveMissingAssetsPath = (workspaceDir: string): string =>
  join(resolveMetadataRootDir(workspaceDir), "missing-assets.json");

export const resolveAssetsRootDir = (workspaceDir: string): string =>
  join(workspaceDir, "assets");

export const resolveAssetAbsolutePath = (workspaceDir: string, relativePath: string): string =>
  join(workspaceDir, relativePath);

export const resolveAssetTempPath = (absolutePath: string): string => `${absolutePath}.tmp`;
