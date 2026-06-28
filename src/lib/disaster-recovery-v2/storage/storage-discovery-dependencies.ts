import { mkdir, writeFile } from "fs/promises";

import { getCloudinary, isCloudinaryConfigured } from "@/lib/cloudinary";
import { createCloudinaryStorageProvider } from "@/lib/disaster-recovery-v2/storage/providers/cloudinary-storage-provider";
import type { CloudinaryListResources } from "@/lib/disaster-recovery-v2/storage/providers/cloudinary-list-resources";
import type { StorageProvider } from "@/lib/disaster-recovery-v2/storage/storage-provider";

const createProductionCloudinaryListResources = (): CloudinaryListResources => {
  if (!isCloudinaryConfigured()) {
    throw new Error("CLOUDINARY_NOT_CONFIGURED");
  }

  const cloudinary = getCloudinary();

  return async ({ resourceType, nextCursor, maxResults = 500 }) => {
    const response = await cloudinary.api.resources({
      type: "upload",
      resource_type: resourceType,
      max_results: maxResults,
      ...(nextCursor ? { next_cursor: nextCursor } : {}),
    });

    return {
      resources: Array.isArray(response.resources) ? response.resources : [],
      nextCursor: typeof response.next_cursor === "string" ? response.next_cursor : undefined,
    };
  };
};

export const createDefaultStorageProviders = (): StorageProvider[] => [
  createCloudinaryStorageProvider({
    required: true,
    listResources: createProductionCloudinaryListResources(),
  }),
];

export type StorageDiscoveryDependencies = {
  ensureStorageDirectory: (directoryPath: string) => Promise<void>;
  writeManifest: (manifestPath: string, manifest: unknown) => Promise<void>;
};

export const createDefaultStorageDiscoveryDependencies = (): StorageDiscoveryDependencies => ({
  ensureStorageDirectory: async (directoryPath) => {
    await mkdir(directoryPath, { recursive: true });
  },
  writeManifest: async (manifestPath, manifest) => {
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  },
});
