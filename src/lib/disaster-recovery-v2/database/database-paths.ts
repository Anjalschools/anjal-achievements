import { join } from "path";

export const resolveDatabaseRootDir = (workspaceDir: string): string =>
  join(workspaceDir, "database");

export const resolveDatabaseCollectionsDir = (workspaceDir: string): string =>
  join(resolveDatabaseRootDir(workspaceDir), "collections");

export const resolveDatabaseManifestPath = (workspaceDir: string): string =>
  join(resolveDatabaseRootDir(workspaceDir), "manifest.json");

export const resolveCollectionBsonPath = (workspaceDir: string, collectionName: string): string =>
  join(resolveDatabaseCollectionsDir(workspaceDir), `${collectionName}.bson`);

export const toManifestRelativeCollectionPath = (collectionName: string): string =>
  `collections/${collectionName}.bson`;
