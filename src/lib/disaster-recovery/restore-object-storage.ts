import "server-only";
import { Readable } from "stream";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getR2BucketName, getR2Client, isR2Configured } from "@/lib/r2";
import { getCloudinary, isCloudinaryConfigured } from "@/lib/cloudinary";
import type { StorageManifestEntry } from "@/lib/disaster-recovery/storage-manifest-types";

export type ObjectRestoreProgress = {
  archivePath: string;
  storageKey: string;
  provider: StorageManifestEntry["provider"];
  status: "restored" | "skipped" | "failed";
  errorMessage?: string;
};

const streamToBuffer = async (stream: Readable): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

const restoreR2Object = async (entry: StorageManifestEntry, content: Buffer): Promise<void> => {
  if (!isR2Configured()) throw new Error("R2_NOT_CONFIGURED");
  const client = getR2Client();
  await client.send(
    new PutObjectCommand({
      Bucket: getR2BucketName(),
      Key: entry.storageKey.replace(/^\/+/, ""),
      Body: content,
      ContentType: entry.mimeType || "application/octet-stream",
    })
  );
};

const parseCloudinaryPublicId = (storageKey: string): { resourceType: string; publicId: string } => {
  if (storageKey.startsWith("cloudinary://")) {
    const [, resourceType = "image", ...rest] = storageKey.replace("cloudinary://", "").split("/");
    return { resourceType, publicId: rest.join("/") };
  }
  return { resourceType: "image", publicId: storageKey };
};

const restoreCloudinaryAsset = async (
  entry: StorageManifestEntry,
  content: Buffer
): Promise<void> => {
  if (!isCloudinaryConfigured()) throw new Error("CLOUDINARY_NOT_CONFIGURED");
  const cloudinary = getCloudinary();
  const { resourceType, publicId } = parseCloudinaryPublicId(entry.storageKey);

  await new Promise<void>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        resource_type: resourceType === "raw" ? "raw" : resourceType,
        overwrite: true,
      },
      (error) => {
        if (error) reject(error);
        else resolve();
      }
    );
    uploadStream.end(content);
  });
};

export const restoreStorageObject = async (input: {
  entry: StorageManifestEntry;
  content: Buffer;
}): Promise<ObjectRestoreProgress> => {
  const { entry, content } = input;

  try {
    if (entry.provider === "r2") {
      await restoreR2Object(entry, content);
    } else if (entry.provider === "cloudinary") {
      await restoreCloudinaryAsset(entry, content);
    } else if (entry.provider === "inline" || entry.provider === "http") {
      // Inline/http assets are embedded in Mongo documents; object bytes are optional cache.
      return {
        archivePath: entry.archivePath,
        storageKey: entry.storageKey,
        provider: entry.provider,
        status: "skipped",
      };
    } else {
      throw new Error(`UNSUPPORTED_PROVIDER:${entry.provider}`);
    }

    return {
      archivePath: entry.archivePath,
      storageKey: entry.storageKey,
      provider: entry.provider,
      status: "restored",
    };
  } catch (error) {
    return {
      archivePath: entry.archivePath,
      storageKey: entry.storageKey,
      provider: entry.provider,
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "RESTORE_FAILED",
    };
  }
};

export const restoreObjectStorageBatch = async (input: {
  objects: Record<string, Buffer>;
  entries: StorageManifestEntry[];
  batchSize?: number;
}): Promise<ObjectRestoreProgress[]> => {
  const batchSize = input.batchSize ?? 25;
  const progress: ObjectRestoreProgress[] = [];

  for (let i = 0; i < input.entries.length; i += batchSize) {
    const batch = input.entries.slice(i, i + batchSize);
    for (const entry of batch) {
      const content = input.objects[entry.archivePath];
      if (!content) {
        progress.push({
          archivePath: entry.archivePath,
          storageKey: entry.storageKey,
          provider: entry.provider,
          status: "failed",
          errorMessage: "OBJECT_BYTES_MISSING",
        });
        continue;
      }
      progress.push(await restoreStorageObject({ entry, content }));
    }
  }

  return progress;
};
