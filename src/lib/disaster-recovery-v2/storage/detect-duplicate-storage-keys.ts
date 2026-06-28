import type {
  StorageDiscoveryAsset,
  StorageDuplicateWarning,
} from "@/lib/disaster-recovery-v2/storage/storage-manifest-types";

export const detectDuplicateStorageKeys = (
  assets: StorageDiscoveryAsset[]
): StorageDuplicateWarning[] => {
  const objectIdsByStorageKey = new Map<string, string[]>();

  for (const asset of assets) {
    const objectIds = objectIdsByStorageKey.get(asset.storageKey) ?? [];
    objectIds.push(asset.objectId);
    objectIdsByStorageKey.set(asset.storageKey, objectIds);
  }

  return [...objectIdsByStorageKey.entries()]
    .filter(([, objectIds]) => objectIds.length > 1)
    .map(([storageKey, objectIds]) => ({
      storageKey,
      objectIds: [...objectIds].sort((left, right) => left.localeCompare(right)),
    }))
    .sort((left, right) => left.storageKey.localeCompare(right.storageKey));
};
