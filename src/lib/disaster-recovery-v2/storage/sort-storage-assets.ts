import type { StorageDiscoveryAsset } from "@/lib/disaster-recovery-v2/storage/storage-manifest-types";

export const compareStorageDiscoveryAssets = (
  left: StorageDiscoveryAsset,
  right: StorageDiscoveryAsset
): number => {
  const providerOrder = left.provider.localeCompare(right.provider);
  if (providerOrder !== 0) return providerOrder;

  const folderOrder = (left.folder ?? "").localeCompare(right.folder ?? "");
  if (folderOrder !== 0) return folderOrder;

  const publicIdOrder = left.publicId.localeCompare(right.publicId);
  if (publicIdOrder !== 0) return publicIdOrder;

  return left.storageKey.localeCompare(right.storageKey);
};

export const sortStorageDiscoveryAssets = (
  assets: StorageDiscoveryAsset[]
): StorageDiscoveryAsset[] => [...assets].sort(compareStorageDiscoveryAssets);
