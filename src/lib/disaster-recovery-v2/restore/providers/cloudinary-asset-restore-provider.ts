import { getCloudinary } from "@/lib/cloudinary";
import { CLOUDINARY_PROVIDER_ID } from "@/lib/disaster-recovery-v2/storage/providers/cloudinary-asset-mapper";
import type {
  AssetRestoreProvider,
  AssetRestoreResult,
} from "@/lib/disaster-recovery-v2/restore/asset-restore-provider";

export type CloudinaryAssetRestoreHandler = (input: {
  localFilePath: string;
  publicId: string;
  resourceType: string;
}) => Promise<AssetRestoreResult>;

const parseCloudinaryStorageKey = (
  storageKey: string
): { resourceType: string; publicId: string } | null => {
  if (!storageKey.startsWith("cloudinary://")) return null;
  const [resourceType = "image", ...rest] = storageKey.replace("cloudinary://", "").split("/");
  const publicId = rest.join("/");
  if (!publicId) return null;
  return { resourceType, publicId };
};

export const createCloudinaryAssetRestoreProvider = (input?: {
  restoreAsset?: CloudinaryAssetRestoreHandler;
}): AssetRestoreProvider => ({
  id: CLOUDINARY_PROVIDER_ID,
  restore: async ({ asset, localFilePath }) => {
    const parsed = parseCloudinaryStorageKey(asset.storageKey);
    if (!parsed) {
      throw new Error(`CLOUDINARY_STORAGE_KEY_INVALID:${asset.storageKey}`);
    }

    if (input?.restoreAsset) {
      return input.restoreAsset({
        localFilePath,
        publicId: parsed.publicId,
        resourceType: parsed.resourceType,
      });
    }

    const cloudinary = getCloudinary();
    await cloudinary.uploader.upload(localFilePath, {
      public_id: parsed.publicId,
      resource_type: parsed.resourceType === "raw" || parsed.resourceType === "video" ? parsed.resourceType : "image",
      overwrite: true,
    });

    return {
      provider: CLOUDINARY_PROVIDER_ID,
      publicId: parsed.publicId,
      storageKey: asset.storageKey,
    };
  },
});
