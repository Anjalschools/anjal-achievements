import type { AssetDownloadReport } from "@/lib/disaster-recovery-v2/storage/asset-download/asset-download-report-types";
import type { DatabaseManifest } from "@/lib/disaster-recovery-v2/database/database-manifest-types";
import type { PackageManifest } from "@/lib/disaster-recovery-v2/package/package-manifest-types";
import { BACKUP_ZIP_FILE_NAME, PACKAGE_MANIFEST_VERSION } from "@/lib/disaster-recovery-v2/package/package-manifest-types";
import type { StorageManifest } from "@/lib/disaster-recovery-v2/storage/storage-manifest-types";

/** Manifest embedded in backup.zip must not include the zip's own digest (self-referential checksum). */
export const buildEmbeddedPackageManifest = (manifest: PackageManifest): PackageManifest => ({
  ...manifest,
  package: {
    ...manifest.package,
    size: 0,
    sha256: "",
  },
  verification: {
    ...manifest.verification,
    sha256: "",
    verified: manifest.verification.verified,
  },
});

export const buildPackageManifest = (input: {
  databaseManifest?: DatabaseManifest | null;
  storageManifest?: StorageManifest | null;
  assetDownloadReport?: AssetDownloadReport | null;
  packageSummary: {
    size: number;
    sha256: string;
    entryCount: number;
  };
  verification: {
    verified: boolean;
    entryCount: number;
    sha256: string;
  };
}): PackageManifest => ({
  version: PACKAGE_MANIFEST_VERSION,
  createdAt: new Date().toISOString(),
  database: {
    collectionCount: input.databaseManifest?.database?.collectionCount ?? 0,
    documentCount: input.databaseManifest?.database?.documentCount ?? 0,
    exportedCollections: input.databaseManifest?.database?.exportedCollections.length ?? 0,
    failedCollections: input.databaseManifest?.database?.failedCollections.length ?? 0,
  },
  storage: {
    objectCount: input.storageManifest?.objectCount ?? 0,
    totalBytes: input.storageManifest?.totalBytes ?? 0,
    providerCount: input.storageManifest?.providerSummaries.length ?? 0,
  },
  assets: {
    totalAssets: input.assetDownloadReport?.totalAssets ?? 0,
    downloaded: input.assetDownloadReport?.downloaded ?? 0,
    skipped: input.assetDownloadReport?.skipped ?? 0,
    missing: input.assetDownloadReport?.missing ?? 0,
    failed: input.assetDownloadReport?.failed ?? 0,
    totalBytes: input.assetDownloadReport?.totalBytes ?? 0,
  },
  package: {
    zipFile: BACKUP_ZIP_FILE_NAME,
    size: input.packageSummary.size,
    sha256: input.packageSummary.sha256,
    entryCount: input.packageSummary.entryCount,
  },
  verification: {
    verified: input.verification.verified,
    verifiedAt: new Date().toISOString(),
    entryCount: input.verification.entryCount,
    sha256: input.verification.sha256,
  },
});
