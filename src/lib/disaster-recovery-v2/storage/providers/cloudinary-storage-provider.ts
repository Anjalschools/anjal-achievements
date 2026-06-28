import type { BackupContext } from "@/lib/disaster-recovery-v2/types/backup-context";
import type { StorageProvider, StorageDiscoveryResult } from "@/lib/disaster-recovery-v2/storage/storage-provider";
import {
  CLOUDINARY_PROVIDER_ID,
  mapCloudinaryResourceToAsset,
} from "@/lib/disaster-recovery-v2/storage/providers/cloudinary-asset-mapper";
import {
  listAllCloudinaryResources,
  type CloudinaryListResources,
} from "@/lib/disaster-recovery-v2/storage/providers/cloudinary-list-resources";
import { sortStorageDiscoveryAssets } from "@/lib/disaster-recovery-v2/storage/sort-storage-assets";

export type CloudinaryStorageProviderOptions = {
  required?: boolean;
  listResources: CloudinaryListResources;
};

export const createCloudinaryStorageProvider = (
  options: CloudinaryStorageProviderOptions
): StorageProvider => ({
  id: CLOUDINARY_PROVIDER_ID,
  required: options.required ?? true,
  discover: async (_context: BackupContext): Promise<StorageDiscoveryResult> => {
    const resources = await listAllCloudinaryResources(options.listResources);
    const assets = sortStorageDiscoveryAssets(resources.map(mapCloudinaryResourceToAsset));

    return {
      provider: CLOUDINARY_PROVIDER_ID,
      assets,
    };
  },
});
