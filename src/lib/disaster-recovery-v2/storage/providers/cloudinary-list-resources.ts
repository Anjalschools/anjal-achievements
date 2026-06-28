import type { CloudinaryListedResource } from "@/lib/disaster-recovery-v2/storage/providers/cloudinary-asset-mapper";

export type CloudinaryResourcePage = {
  resources: CloudinaryListedResource[];
  nextCursor?: string;
};

export type CloudinaryListResources = (input: {
  resourceType: "image" | "video" | "raw";
  nextCursor?: string;
  maxResults?: number;
}) => Promise<CloudinaryResourcePage>;

const CLOUDINARY_RESOURCE_TYPES = ["image", "video", "raw"] as const;

export const listAllCloudinaryResources = async (
  listResources: CloudinaryListResources,
  maxResults = 500
): Promise<CloudinaryListedResource[]> => {
  const resources: CloudinaryListedResource[] = [];

  for (const resourceType of CLOUDINARY_RESOURCE_TYPES) {
    let nextCursor: string | undefined;

    do {
      const page = await listResources({
        resourceType,
        nextCursor,
        maxResults,
      });

      resources.push(...page.resources);
      nextCursor = page.nextCursor;
    } while (nextCursor);
  }

  return resources;
};
