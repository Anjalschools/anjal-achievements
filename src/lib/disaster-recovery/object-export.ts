import "server-only";
import { createHash } from "crypto";
import { Readable } from "stream";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getR2BucketName, getR2Client, isR2Configured } from "@/lib/r2";
import { getCloudinary, isCloudinaryConfigured } from "@/lib/cloudinary";
import { hashContent } from "@/lib/backup/backup-manifest";
import { isHttpDownloadAllowed } from "@/lib/disaster-recovery/http-download-policy";
import type { StorageManifestEntry } from "@/lib/disaster-recovery/storage-manifest-types";

export { isHttpDownloadAllowed };

export type ExportedObject = {
  entry: StorageManifestEntry;
  content: Buffer;
};

const streamToBuffer = async (stream: Readable): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

const decodeDataUrl = (dataUrl: string): Buffer => {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl.trim());
  if (!match?.[2]) {
    throw new Error("INLINE_DATA_URL_INVALID");
  }
  return Buffer.from(match[2], "base64");
};

const downloadR2Object = async (key: string): Promise<Buffer> => {
  if (!isR2Configured()) throw new Error("R2_NOT_CONFIGURED");
  const client = getR2Client();
  const response = await client.send(
    new GetObjectCommand({
      Bucket: getR2BucketName(),
      Key: key.replace(/^\/+/, ""),
    })
  );
  if (!response.Body) throw new Error("R2_OBJECT_EMPTY");
  return streamToBuffer(response.Body as Readable);
};

const parseCloudinaryReference = (
  storageKey: string
): { resourceType: string; publicId: string } => {
  if (storageKey.startsWith("cloudinary://")) {
    const [, resourceType = "image", ...rest] = storageKey.replace("cloudinary://", "").split("/");
    return { resourceType, publicId: rest.join("/") };
  }
  if (/^https?:\/\//i.test(storageKey)) {
    return { resourceType: "image", publicId: storageKey };
  }
  return { resourceType: "image", publicId: storageKey };
};

const downloadCloudinaryAsset = async (storageKey: string): Promise<Buffer> => {
  if (!isCloudinaryConfigured()) throw new Error("CLOUDINARY_NOT_CONFIGURED");
  const cloudinary = getCloudinary();
  const { resourceType, publicId } = parseCloudinaryReference(storageKey);

  let downloadUrl = publicId;
  if (!/^https?:\/\//i.test(publicId)) {
    downloadUrl = cloudinary.url(publicId, {
      resource_type: resourceType === "raw" ? "raw" : resourceType,
      secure: true,
      flags: "attachment",
    });
  }

  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`CLOUDINARY_DOWNLOAD_FAILED:${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
};

const downloadHttpAsset = async (url: string): Promise<Buffer> => {
  if (!isHttpDownloadAllowed(url)) {
    throw new Error("HTTP_DOWNLOAD_NOT_ALLOWED");
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP_DOWNLOAD_FAILED:${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
};

export const exportStorageObject = async (
  entry: StorageManifestEntry
): Promise<ExportedObject> => {
  let content: Buffer;

  if (entry.provider === "r2") {
    content = await downloadR2Object(entry.storageKey);
  } else if (entry.provider === "cloudinary") {
    content = await downloadCloudinaryAsset(entry.storageKey);
  } else if (entry.provider === "http") {
    content = await downloadHttpAsset(entry.storageKey);
  } else if (entry.provider === "inline") {
    content = decodeDataUrl(entry.storageKey);
  } else {
    throw new Error(`UNSUPPORTED_PROVIDER:${entry.provider}`);
  }

  const checksum = hashContent(content);
  if (entry.fileSize && entry.fileSize > 0 && content.byteLength !== entry.fileSize) {
    // size mismatch is recorded but export still succeeds for DR completeness
    entry.errorMessage = `SIZE_MISMATCH:expected=${entry.fileSize},actual=${content.byteLength}`;
  }

  return {
    entry: {
      ...entry,
      fileSize: content.byteLength,
      checksum,
      status: "exported",
    },
    content,
  };
};

export const exportStorageObjects = async (
  entries: StorageManifestEntry[],
  options: { maxConcurrency?: number } = {}
): Promise<{ exported: ExportedObject[]; failures: StorageManifestEntry[] }> => {
  const concurrency = Math.max(1, options.maxConcurrency ?? 3);
  const exported: ExportedObject[] = [];
  const failures: StorageManifestEntry[] = [];

  for (let i = 0; i < entries.length; i += concurrency) {
    const batch = entries.slice(i, i + concurrency);
    const results = await Promise.allSettled(batch.map((entry) => exportStorageObject(entry)));

    results.forEach((result, index) => {
      const source = batch[index];
      if (!source) return;
      if (result.status === "fulfilled") {
        exported.push(result.value);
        return;
      }
      failures.push({
        ...source,
        status: "failed",
        errorMessage: result.reason instanceof Error ? result.reason.message : "EXPORT_FAILED",
      });
    });
  }

  return { exported, failures };
};

export const buildObjectChecksum = (content: Buffer): string =>
  createHash("sha256").update(content).digest("hex");
