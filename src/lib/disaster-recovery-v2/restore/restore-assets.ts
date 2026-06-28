import { resolveAssetRelativePath, sortAssetsForDownload } from "@/lib/disaster-recovery-v2/storage/asset-download/resolve-asset-file-path";
import type { StorageManifest } from "@/lib/disaster-recovery-v2/storage/storage-manifest-types";
import type { AssetRestoreProvider } from "@/lib/disaster-recovery-v2/restore/asset-restore-provider";
import type { RestoreContext } from "@/lib/disaster-recovery-v2/restore/restore-context";
import type { RestoreAssetResult } from "@/lib/disaster-recovery-v2/restore/restore-report-types";
import { resolveExtractedAssetPath } from "@/lib/disaster-recovery-v2/restore/restore-paths";
import { logDrV2 } from "@/lib/disaster-recovery-v2/utils/logging";

export type RestoreAssetsDependencies = {
  readStorageManifest: (manifestPath: string) => Promise<StorageManifest>;
  pathExists: (filePath: string) => Promise<boolean>;
};

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const restoreAssets = async (input: {
  context: RestoreContext;
  extractedRootDir: string;
  storageManifestPath: string;
  provider: AssetRestoreProvider;
  deps: RestoreAssetsDependencies;
}): Promise<RestoreAssetResult[]> => {
  const storageManifest = await input.deps.readStorageManifest(input.storageManifestPath);
  const assets = sortAssetsForDownload(storageManifest.objects);
  const results: RestoreAssetResult[] = [];

  logDrV2("ASSET_RESTORE_STARTED", {
    jobId: input.context.config.jobId,
    provider: input.provider.id,
    assetCount: assets.length,
  });

  for (const asset of assets) {
    const startedAt = Date.now();
    const relativeAssetPath = resolveAssetRelativePath(asset);
    const localFilePath = resolveExtractedAssetPath(input.extractedRootDir, relativeAssetPath);

    if (asset.provider !== input.provider.id) {
      results.push({
        objectId: asset.objectId,
        provider: asset.provider,
        publicId: asset.publicId,
        storageKey: asset.storageKey,
        status: "skipped",
        durationMs: Date.now() - startedAt,
        error: "PROVIDER_NOT_SUPPORTED",
      });
      continue;
    }

    if (!(await input.deps.pathExists(localFilePath))) {
      results.push({
        objectId: asset.objectId,
        provider: asset.provider,
        publicId: asset.publicId,
        storageKey: asset.storageKey,
        status: "skipped",
        durationMs: Date.now() - startedAt,
        error: "LOCAL_ASSET_MISSING",
      });
      continue;
    }

    try {
      await input.provider.restore({
        asset,
        localFilePath,
        context: input.context,
      });

      results.push({
        objectId: asset.objectId,
        provider: asset.provider,
        publicId: asset.publicId,
        storageKey: asset.storageKey,
        status: "restored",
        durationMs: Date.now() - startedAt,
      });

      logDrV2("ASSET_RESTORED", {
        jobId: input.context.config.jobId,
        objectId: asset.objectId,
        publicId: asset.publicId,
        storageKey: asset.storageKey,
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      results.push({
        objectId: asset.objectId,
        provider: asset.provider,
        publicId: asset.publicId,
        storageKey: asset.storageKey,
        status: "failed",
        durationMs: Date.now() - startedAt,
        error: toErrorMessage(error),
      });
    }
  }

  return results;
};
