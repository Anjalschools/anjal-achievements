export type PackageManifestDatabaseSummary = {
  collectionCount: number;
  documentCount: number;
  exportedCollections: number;
  failedCollections: number;
};

export type PackageManifestStorageSummary = {
  objectCount: number;
  totalBytes: number;
  providerCount: number;
};

export type PackageManifestAssetsSummary = {
  totalAssets: number;
  downloaded: number;
  skipped: number;
  missing: number;
  failed: number;
  totalBytes: number;
};

export type PackageManifestPackageSummary = {
  zipFile: string;
  size: number;
  sha256: string;
  entryCount: number;
};

export type PackageManifestVerificationSummary = {
  verified: boolean;
  verifiedAt: string;
  entryCount: number;
  sha256: string;
};

export type PackageManifestObjectStorageSummary = {
  providers: string[];
  objects: number;
  bytes: number;
};

export type PackageManifest = {
  version: 2;
  createdAt: string;
  database: PackageManifestDatabaseSummary;
  storage: PackageManifestStorageSummary;
  assets: PackageManifestAssetsSummary;
  objectStorage?: PackageManifestObjectStorageSummary;
  package: PackageManifestPackageSummary;
  verification: PackageManifestVerificationSummary;
};

export const PACKAGE_MANIFEST_VERSION = 2 as const;

export const BACKUP_ZIP_FILE_NAME = "backup.zip" as const;
