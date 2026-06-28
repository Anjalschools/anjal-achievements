import { join } from "path";

export const resolveStorageRootDir = (workspaceDir: string): string =>
  join(workspaceDir, "storage");

export const resolveStorageManifestPath = (workspaceDir: string): string =>
  join(resolveStorageRootDir(workspaceDir), "storage-manifest.json");
