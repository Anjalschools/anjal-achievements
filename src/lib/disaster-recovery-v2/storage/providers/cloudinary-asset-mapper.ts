import type { StorageDiscoveryAsset } from "@/lib/disaster-recovery-v2/storage/storage-manifest-types";

export const CLOUDINARY_PROVIDER_ID = "cloudinary" as const;

export const buildCloudinaryStorageKey = (
  resourceType: string,
  publicId: string
): string => `cloudinary://${resourceType}/${publicId}`;

export const extractCloudinaryFolder = (publicId: string): string => {
  const separatorIndex = publicId.lastIndexOf("/");
  if (separatorIndex <= 0) return "";
  return publicId.slice(0, separatorIndex);
};

export const buildCloudinaryObjectId = (input: {
  resourceType: string;
  publicId: string;
  version?: number | string;
}): string =>
  `cloudinary:${input.resourceType}:${input.publicId}@${input.version ?? "latest"}`;

export const resolveCloudinaryContentType = (input: {
  resourceType: string;
  format?: string;
}): string | undefined => {
  if (input.format) {
    if (input.resourceType === "video") return `video/${input.format}`;
    if (input.resourceType === "raw") return "application/octet-stream";
    return `image/${input.format}`;
  }

  if (input.resourceType === "video") return "video/*";
  if (input.resourceType === "raw") return "application/octet-stream";
  return "image/*";
};

export type CloudinaryListedResource = {
  public_id: string;
  resource_type: string;
  format?: string;
  version?: number;
  bytes?: number;
  created_at?: string;
  secure_url?: string;
  url?: string;
  folder?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
};

export const mapCloudinaryResourceToAsset = (
  resource: CloudinaryListedResource
): StorageDiscoveryAsset => {
  const publicId = resource.public_id;
  const folder = resource.folder ?? extractCloudinaryFolder(publicId);

  return {
    objectId: buildCloudinaryObjectId({
      resourceType: resource.resource_type,
      publicId,
      version: resource.version,
    }),
    provider: CLOUDINARY_PROVIDER_ID,
    publicId,
    storageKey: buildCloudinaryStorageKey(resource.resource_type, publicId),
    downloadUrl: resource.secure_url ?? resource.url,
    contentType: resolveCloudinaryContentType({
      resourceType: resource.resource_type,
      format: resource.format,
    }),
    bytes: resource.bytes,
    createdAt: resource.created_at,
    updatedAt: resource.created_at,
    checksumAvailable: false,
    metadata: resource.metadata ?? {},
    tags: [...(resource.tags ?? [])].sort((left, right) => left.localeCompare(right)),
    folder,
    version: resource.version,
  };
};
