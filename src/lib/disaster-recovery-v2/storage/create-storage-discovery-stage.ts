import { detectDuplicateStorageKeys } from "@/lib/disaster-recovery-v2/storage/detect-duplicate-storage-keys";
import {
  resolveStorageManifestPath,
  resolveStorageRootDir,
} from "@/lib/disaster-recovery-v2/storage/storage-paths";
import type { StorageDiscoveryDependencies } from "@/lib/disaster-recovery-v2/storage/storage-discovery-dependencies";
import {
  createEmptyStorageManifest,
  type StorageDiscoveryAsset,
  type StorageManifest,
  type StorageProviderSummary,
} from "@/lib/disaster-recovery-v2/storage/storage-manifest-types";
import type { StorageProvider } from "@/lib/disaster-recovery-v2/storage/storage-provider";
import { sortStorageDiscoveryAssets } from "@/lib/disaster-recovery-v2/storage/sort-storage-assets";
import {
  STORAGE_INVENTORY_STAGE_ID,
  type StorageInventoryStage,
} from "@/lib/disaster-recovery-v2/storage/storage-inventory-stage";
import type { BackupContext } from "@/lib/disaster-recovery-v2/types/backup-context";
import { createStageResult } from "@/lib/disaster-recovery-v2/types/stage-result";
import type { StageWarning } from "@/lib/disaster-recovery-v2/types/stage-result";
import { logDrV2 } from "@/lib/disaster-recovery-v2/utils/logging";

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const executeStorageDiscoveryStage = async (
  context: BackupContext,
  providers: StorageProvider[],
  deps: StorageDiscoveryDependencies
): Promise<{
  manifest: StorageManifest;
  manifestPath: string;
  storageRootDir: string;
  stageStartedAt: Date;
  stageWarnings: StageWarning[];
}> => {
  const stageStartedAt = new Date();
  const { workspaceDir, jobId } = context.config;
  const storageRootDir = resolveStorageRootDir(workspaceDir);
  const manifestPath = resolveStorageManifestPath(workspaceDir);

  await deps.ensureStorageDirectory(storageRootDir);

  const discoveredAssets: StorageDiscoveryAsset[] = [];
  const providerSummaries: StorageProviderSummary[] = [];
  const stageWarnings: StageWarning[] = [];

  for (const provider of providers) {
    const providerStartedAt = Date.now();

    logDrV2("STORAGE_PROVIDER_STARTED", {
      jobId,
      provider: provider.id,
      required: provider.required,
    });

    try {
      const result = await provider.discover(context);
      discoveredAssets.push(...result.assets);

      providerSummaries.push({
        provider: provider.id,
        required: provider.required,
        success: true,
        objectCount: result.assets.length,
        durationMs: Date.now() - providerStartedAt,
      });

      logDrV2("STORAGE_PROVIDER_COMPLETED", {
        jobId,
        provider: provider.id,
        objectCount: result.assets.length,
        durationMs: Date.now() - providerStartedAt,
      });
    } catch (error) {
      const message = toErrorMessage(error);
      providerSummaries.push({
        provider: provider.id,
        required: provider.required,
        success: false,
        objectCount: 0,
        errorCode: "STORAGE_PROVIDER_DISCOVERY_FAILED",
        message,
        durationMs: Date.now() - providerStartedAt,
      });

      logDrV2("STORAGE_PROVIDER_COMPLETED", {
        jobId,
        provider: provider.id,
        success: false,
        message,
        durationMs: Date.now() - providerStartedAt,
      });
    }
  }

  const sortedObjects = sortStorageDiscoveryAssets(discoveredAssets);
  const duplicateWarnings = detectDuplicateStorageKeys(sortedObjects);

  for (const duplicate of duplicateWarnings) {
    logDrV2("STORAGE_DUPLICATE_DETECTED", {
      jobId,
      storageKey: duplicate.storageKey,
      objectIds: duplicate.objectIds,
    });

    stageWarnings.push({
      code: "STORAGE_DUPLICATE_DETECTED",
      message: `Duplicate storage key detected: ${duplicate.storageKey}`,
    });
  }

  const manifest: StorageManifest = {
    ...createEmptyStorageManifest(),
    generatedAt: new Date().toISOString(),
    objectCount: sortedObjects.length,
    totalBytes: sortedObjects.reduce((total, asset) => total + (asset.bytes ?? 0), 0),
    objects: sortedObjects,
    duplicateWarnings,
    providerSummaries,
  };

  await deps.writeManifest(manifestPath, manifest);

  return {
    manifest,
    manifestPath,
    storageRootDir,
    stageStartedAt,
    stageWarnings,
  };
};

export const createStorageDiscoveryStage = (
  providers: StorageProvider[],
  deps: StorageDiscoveryDependencies
): StorageInventoryStage => ({
  id: STORAGE_INVENTORY_STAGE_ID,
  name: "Storage Discovery",
  execute: async (context) => {
    const { manifest, manifestPath, storageRootDir, stageStartedAt, stageWarnings } =
      await executeStorageDiscoveryStage(context, providers, deps);

    const requiredProviderFailures = manifest.providerSummaries.filter(
      (summary) => summary.required && !summary.success
    );
    const hasRequiredProviderFailures = requiredProviderFailures.length > 0;

    context.artifacts.storageInventory = {
      manifestPath,
      storageRootDir,
      manifest,
    };

    const completedAt = new Date();

    logDrV2("STORAGE_DISCOVERY_COMPLETED", {
      jobId: context.config.jobId,
      success: !hasRequiredProviderFailures,
      objectCount: manifest.objectCount,
      duplicateCount: manifest.duplicateWarnings.length,
      failedProviderCount: requiredProviderFailures.length,
      durationMs: completedAt.getTime() - stageStartedAt.getTime(),
    });

    return createStageResult({
      stageId: STORAGE_INVENTORY_STAGE_ID,
      success: !hasRequiredProviderFailures,
      startedAt: stageStartedAt,
      completedAt,
      warnings: stageWarnings,
      errors: requiredProviderFailures.map((summary) => ({
        code: summary.errorCode ?? "STORAGE_PROVIDER_DISCOVERY_FAILED",
        message: `${summary.provider}: ${summary.message ?? "Provider discovery failed"}`,
      })),
    });
  },
});
