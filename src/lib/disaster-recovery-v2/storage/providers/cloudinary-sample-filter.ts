import type { CloudinaryListedResource } from "@/lib/disaster-recovery-v2/storage/providers/cloudinary-asset-mapper";
import { logDrV2Debug } from "@/lib/disaster-recovery-v2/utils/logging";

export const isCloudinarySamplePublicId = (publicId: string): boolean => {
  const normalized = publicId.trim();
  return normalized === "samples" || normalized.startsWith("samples/");
};

export const filterCloudinaryListedResources = (
  resources: CloudinaryListedResource[]
): CloudinaryListedResource[] =>
  resources.filter((resource) => {
    if (!isCloudinarySamplePublicId(resource.public_id)) {
      return true;
    }

    logDrV2Debug("STORAGE_SKIP_SAMPLE_ASSET", {
      publicId: resource.public_id,
      resourceType: resource.resource_type,
      type: resource.resource_type,
    });

    return false;
  });
