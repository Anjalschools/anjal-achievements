import "server-only";
import { createHash } from "crypto";
import { Readable } from "stream";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getR2BucketName, getR2Client, isR2Configured } from "@/lib/r2";
import { getCloudinary, isCloudinaryConfigured, resolveCloudinaryResourceType } from "@/lib/cloudinary";
import { hashContent } from "@/lib/backup/backup-manifest";
import { isHttpDownloadAllowed } from "@/lib/disaster-recovery/http-download-policy";
import {
  exportStorageObjectsStreamingSource,
  runSequentialObjectExport,
  runSequentialObjectStreamExport,
  type ExportedObjectStreamPayload,
  type StreamingObjectExportProgress,
  type StreamingObjectExportResult,
} from "@/lib/disaster-recovery/dr-export-streaming";
import {
  createHashingObjectStream,
  webBodyToNodeStream,
} from "@/lib/disaster-recovery/dr-stream-utils";
import type { StorageManifestEntry } from "@/lib/disaster-recovery/storage-manifest-types";

export { isHttpDownloadAllowed };
export {
  exportStorageObjectsStreamingSource,
  type ExportedObjectStreamPayload,
  type StreamingObjectExportProgress,
  type StreamingObjectExportResult,
};

export type ExportedObject = {
  entry: StorageManifestEntry;
  content: Buffer;
};

export type ExportedObjectStream = {
  entry: StorageManifestEntry;
  stream: Readable;
  completed: Promise<StorageManifestEntry>;
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

const openR2ObjectStream = async (key: string): Promise<Readable> => {
  if (!isR2Configured()) throw new Error("R2_NOT_CONFIGURED");
  const client = getR2Client();
  const response = await client.send(
    new GetObjectCommand({
      Bucket: getR2BucketName(),
      Key: key.replace(/^\/+/, ""),
    })
  );
  if (!response.Body) throw new Error("R2_OBJECT_EMPTY");
  return response.Body as Readable;
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

const resolveCloudinaryDownloadUrl = (storageKey: string): string => {
  if (!isCloudinaryConfigured()) throw new Error("CLOUDINARY_NOT_CONFIGURED");
  const cloudinary = getCloudinary();
  const { resourceType, publicId } = parseCloudinaryReference(storageKey);

  if (/^https?:\/\//i.test(publicId)) {
    return publicId;
  }

  return cloudinary.url(publicId, {
    resource_type: resolveCloudinaryResourceType(resourceType),
    secure: true,
    flags: "attachment",
  });
};

const openHttpObjectStream = async (url: string): Promise<Readable> => {
  if (!isHttpDownloadAllowed(url)) {
    throw new Error("HTTP_DOWNLOAD_NOT_ALLOWED");
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP_DOWNLOAD_FAILED:${response.status}`);
  }
  if (!response.body) {
    throw new Error("HTTP_BODY_EMPTY");
  }
  return webBodyToNodeStream(response.body);
};

const openCloudinaryObjectStream = async (storageKey: string): Promise<Readable> => {
  const downloadUrl = resolveCloudinaryDownloadUrl(storageKey);
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`CLOUDINARY_DOWNLOAD_FAILED:${response.status}`);
  }
  if (!response.body) {
    throw new Error("CLOUDINARY_BODY_EMPTY");
  }
  return webBodyToNodeStream(response.body);
};

const openInlineObjectStream = (storageKey: string): Readable => {
  const content = decodeDataUrl(storageKey);
  return Readable.from(content);
};

const openObjectSourceStream = async (entry: StorageManifestEntry): Promise<Readable> => {
  if (entry.provider === "r2") {
    return openR2ObjectStream(entry.storageKey);
  }
  if (entry.provider === "cloudinary") {
    return openCloudinaryObjectStream(entry.storageKey);
  }
  if (entry.provider === "http") {
    return openHttpObjectStream(entry.storageKey);
  }
  if (entry.provider === "inline") {
    return openInlineObjectStream(entry.storageKey);
  }
  throw new Error(`UNSUPPORTED_PROVIDER:${entry.provider}`);
};

const downloadR2Object = async (key: string): Promise<Buffer> => {
  return streamToBuffer(await openR2ObjectStream(key));
};

const downloadCloudinaryAsset = async (storageKey: string): Promise<Buffer> => {
  return streamToBuffer(await openCloudinaryObjectStream(storageKey));
};

const downloadHttpAsset = async (url: string): Promise<Buffer> => {
  return streamToBuffer(await openHttpObjectStream(url));
};

export const exportStorageObjectStream = async (
  entry: StorageManifestEntry
): Promise<ExportedObjectStream> => {
  const sourceStream = await openObjectSourceStream(entry);
  const { stream, completed } = createHashingObjectStream(entry, sourceStream);

  return {
    entry,
    stream,
    completed,
  };
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

export const exportStorageObjectsStreaming = async (input: {
  entries: StorageManifestEntry[];
  onObjectReady: (payload: { entry: StorageManifestEntry; content: Buffer }) => Promise<void> | void;
  onProgress?: (progress: StreamingObjectExportProgress) => void;
}): Promise<StreamingObjectExportResult> =>
  runSequentialObjectExport({
    entries: input.entries,
    exportObject: exportStorageObject,
    onObjectReady: input.onObjectReady,
    onProgress: input.onProgress,
  });

export const exportStorageObjectsStreamExport = async (input: {
  entries: StorageManifestEntry[];
  onObjectReady: (payload: ExportedObjectStreamPayload) => Promise<void> | void;
  onProgress?: (progress: StreamingObjectExportProgress) => void;
}): Promise<StreamingObjectExportResult> =>
  runSequentialObjectStreamExport({
    entries: input.entries,
    exportObjectStream: async (entry) => {
      const exported = await exportStorageObjectStream(entry);
      return {
        stream: exported.stream,
        completed: exported.completed,
        archivePath: entry.archivePath,
      };
    },
    onObjectReady: input.onObjectReady,
    onProgress: input.onProgress,
  });

export const exportStorageObjects = async (
  entries: StorageManifestEntry[],
  options: { maxConcurrency?: number } = {}
): Promise<{ exported: ExportedObject[]; failures: StorageManifestEntry[] }> => {
  const concurrency = Math.max(1, options.maxConcurrency ?? 1);
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
