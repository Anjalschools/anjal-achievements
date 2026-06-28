import { BackupEngine } from "@/lib/disaster-recovery-v2/engine/backup-engine";
import { createDatabaseStage } from "@/lib/disaster-recovery-v2/database/create-database-stage";
import {
  createDefaultDatabaseExportDependencies,
  type DatabaseExportDependencies,
} from "@/lib/disaster-recovery-v2/database/database-export-dependencies";
import { createAssetDownloadStage } from "@/lib/disaster-recovery-v2/storage/asset-download/create-asset-download-stage";
import {
  createDefaultAssetDownloadDependencies,
  type AssetDownloadDependencies,
} from "@/lib/disaster-recovery-v2/storage/asset-download/asset-download-dependencies";
import { createStorageDiscoveryStage } from "@/lib/disaster-recovery-v2/storage/create-storage-discovery-stage";
import {
  createDefaultStorageDiscoveryDependencies,
  createDefaultStorageProviders,
  type StorageDiscoveryDependencies,
} from "@/lib/disaster-recovery-v2/storage/storage-discovery-dependencies";
import type { StorageProvider } from "@/lib/disaster-recovery-v2/storage/storage-provider";
import { createNotImplementedStage } from "@/lib/disaster-recovery-v2/stages/not-implemented-stage";
import { createPackageBuildStage } from "@/lib/disaster-recovery-v2/package/create-package-build-stage";
import {
  createDefaultPackageBuildDependencies,
  type PackageBuildDependencies,
} from "@/lib/disaster-recovery-v2/package/package-build-dependencies";
import { createUploadStage } from "@/lib/disaster-recovery-v2/upload/create-upload-stage";
import {
  createDefaultUploadDependencies,
  createDefaultUploadProvider,
} from "@/lib/disaster-recovery-v2/upload/upload-dependencies";
import type { BackupUploadProvider } from "@/lib/disaster-recovery-v2/upload/upload-provider";
import type { UploadDependencies } from "@/lib/disaster-recovery-v2/upload/upload-dependencies";

export type DefaultV2BackupEngineOptions = {
  databaseDeps?: DatabaseExportDependencies;
  storageProviders?: StorageProvider[];
  storageDiscoveryDeps?: StorageDiscoveryDependencies;
  assetDownloadDeps?: AssetDownloadDependencies;
  packageBuildDeps?: PackageBuildDependencies;
  uploadProvider?: BackupUploadProvider;
  uploadDeps?: UploadDependencies;
};

export const createProductionDatabaseStage = () =>
  createDatabaseStage(createDefaultDatabaseExportDependencies());

export const createProductionStorageDiscoveryStage = () =>
  createStorageDiscoveryStage(
    createDefaultStorageProviders(),
    createDefaultStorageDiscoveryDependencies()
  );

export const createProductionAssetDownloadStage = () =>
  createAssetDownloadStage(createDefaultAssetDownloadDependencies());

export const createProductionPackageBuildStage = () =>
  createPackageBuildStage(createDefaultPackageBuildDependencies());

export const createProductionUploadStage = () =>
  createUploadStage(createDefaultUploadProvider(), createDefaultUploadDependencies());

export const createDefaultV2BackupEngine = (
  options: DefaultV2BackupEngineOptions = {}
): BackupEngine => {
  const engine = new BackupEngine({ stopOnFirstFailure: true });
  const resolvedDatabaseDeps = options.databaseDeps ?? createDefaultDatabaseExportDependencies();
  const resolvedStorageProviders =
    options.storageProviders ?? createDefaultStorageProviders();
  const resolvedStorageDiscoveryDeps =
    options.storageDiscoveryDeps ?? createDefaultStorageDiscoveryDependencies();
  const resolvedAssetDownloadDeps =
    options.assetDownloadDeps ?? createDefaultAssetDownloadDependencies();
  const resolvedPackageBuildDeps =
    options.packageBuildDeps ?? createDefaultPackageBuildDependencies();
  const resolvedUploadProvider = options.uploadProvider ?? createDefaultUploadProvider();
  const resolvedUploadDeps = options.uploadDeps ?? createDefaultUploadDependencies();

  engine
    .registerStage(createDatabaseStage(resolvedDatabaseDeps))
    .registerStage(
      createStorageDiscoveryStage(resolvedStorageProviders, resolvedStorageDiscoveryDeps)
    )
    .registerStage(createAssetDownloadStage(resolvedAssetDownloadDeps))
    .registerStage(createPackageBuildStage(resolvedPackageBuildDeps))
    .registerStage(
      createNotImplementedStage({
        id: "verification",
        name: "Verification",
      })
    )
    .registerStage(createUploadStage(resolvedUploadProvider, resolvedUploadDeps));

  return engine;
};
