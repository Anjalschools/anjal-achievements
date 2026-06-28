import { BackupEngine } from "@/lib/disaster-recovery-v2/engine/backup-engine";
import { createDatabaseStage } from "@/lib/disaster-recovery-v2/database/create-database-stage";
import { createDefaultDatabaseExportDependencies } from "@/lib/disaster-recovery-v2/database/database-export-dependencies";
import { createAssetDownloadStage } from "@/lib/disaster-recovery-v2/storage/asset-download/create-asset-download-stage";
import { createDefaultAssetDownloadDependencies } from "@/lib/disaster-recovery-v2/storage/asset-download/asset-download-dependencies";
import { createStorageDiscoveryStage } from "@/lib/disaster-recovery-v2/storage/create-storage-discovery-stage";
import {
  createDefaultStorageDiscoveryDependencies,
  createDefaultStorageProviders,
} from "@/lib/disaster-recovery-v2/storage/storage-discovery-dependencies";
import { createPackageBuildStage } from "@/lib/disaster-recovery-v2/package/create-package-build-stage";
import { createDefaultPackageBuildDependencies } from "@/lib/disaster-recovery-v2/package/package-build-dependencies";
import { createUploadStage } from "@/lib/disaster-recovery-v2/upload/create-upload-stage";
import {
  createDefaultUploadDependencies,
  createDefaultUploadProvider,
} from "@/lib/disaster-recovery-v2/upload/upload-dependencies";
import type { DefaultV2BackupEngineOptions } from "@/lib/disaster-recovery-v2/engine/create-v2-backup-engine";

export const createProductionIntegratedV2BackupEngine = (
  options: DefaultV2BackupEngineOptions = {}
): BackupEngine => {
  const engine = new BackupEngine({ stopOnFirstFailure: true });

  engine
    .registerStage(
      createDatabaseStage(options.databaseDeps ?? createDefaultDatabaseExportDependencies())
    )
    .registerStage(
      createStorageDiscoveryStage(
        options.storageProviders ?? createDefaultStorageProviders(),
        options.storageDiscoveryDeps ?? createDefaultStorageDiscoveryDependencies()
      )
    )
    .registerStage(
      createAssetDownloadStage(options.assetDownloadDeps ?? createDefaultAssetDownloadDependencies())
    )
    .registerStage(
      createPackageBuildStage(options.packageBuildDeps ?? createDefaultPackageBuildDependencies())
    )
    .registerStage(
      createUploadStage(
        options.uploadProvider ?? createDefaultUploadProvider(),
        options.uploadDeps ?? createDefaultUploadDependencies()
      )
    );

  return engine;
};
