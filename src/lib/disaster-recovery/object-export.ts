import "server-only";
import { createHash } from "crypto";
import { Readable } from "stream";
import { isR2Configured } from "@/lib/r2";
import { getCloudinary, isCloudinaryConfigured, resolveCloudinaryResourceType } from "@/lib/cloudinary";
import { hashContent } from "@/lib/backup/backup-manifest";
import { isHttpDownloadAllowed } from "@/lib/disaster-recovery/http-download-policy";
import {
  exportStorageObjectsStreamingSource,
  runSequentialObjectExport,
  runSequentialObjectStreamExport,
  type DrStreamExportGuards,
  type ExportedObjectStreamPayload,
  type StreamingObjectExportProgress,
  type StreamingObjectExportResult,
} from "@/lib/disaster-recovery/dr-export-streaming";
import {
  DR_OBJECT_DOWNLOAD_TIMEOUT_MS,
  withDrAbortTimeout,
} from "@/lib/disaster-recovery/dr-async-timeout";
import {
  attachDrObjectStreamErrorLogging,
  buildDrObjectStreamContext,
  logDrDownloadProviderFailed,
} from "@/lib/disaster-recovery/dr-object-stream-diagnostics";
import { sendR2GetObject } from "@/lib/disaster-recovery/dr-r2-sdk";
import { logDrObjectDiag } from "@/lib/disaster-recovery/dr-stream-lifecycle";
import {
  createHashingObjectStream,
  webBodyToNodeStream,
} from "@/lib/disaster-recovery/dr-stream-utils";
import {
  logDrBufferFallbackEnter,
  logDrBufferFallbackExit,
} from "@/lib/disaster-recovery/dr-buffer-diagnostics";
import type { StorageManifestEntry } from "@/lib/disaster-recovery/storage-manifest-types";

export { isHttpDownloadAllowed };
export {
  exportStorageObjectsStreamingSource,
  type DrStreamExportGuards,
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

const openR2ObjectStream = async (key: string, objectKey: string): Promise<Readable> => {
  if (!isR2Configured()) throw new Error("R2_NOT_CONFIGURED");
  try {
    return await withDrAbortTimeout(
      "r2ObjectDownload",
      DR_OBJECT_DOWNLOAD_TIMEOUT_MS,
      async (signal) => {
        logDrObjectDiag("Download started", { objectKey, provider: "r2", storageKey: key });
        const response = await sendR2GetObject({
          key,
          abortSignal: signal,
        });
        if (!response.Body) throw new Error("R2_OBJECT_EMPTY");
        const stream = response.Body as Readable;
        logDrObjectDiag("Download open", { objectKey, provider: "r2" });
        return stream;
      },
      { objectKey }
    );
  } catch (error) {
    logDrDownloadProviderFailed(
      {
        provider: "r2",
        storageKey: key,
        archivePath: objectKey,
        streamName: "r2-download",
      },
      error
    );
    throw error;
  }
};

const parseCloudinaryReference = (
  storageKey: string
): { resourceType: string; publicId: string } => {
  if (storageKey.startsWith("cloudinary://")) {
    const [, resourceType = "image", ...rest] = storageKey.replace("cloudinary://", "").split("/");
    const parsed = {
      resourceType,
      publicId: rest.join("/"),
    };

    console.info("[DR] CLOUDINARY_REFERENCE", parsed);

    return parsed;
  }
  if (/^https?:\/\//i.test(storageKey)) {
    const parsed = {
      resourceType: "image",
      publicId: storageKey,
    };

    console.info("[DR] CLOUDINARY_REFERENCE", parsed);

    return parsed;
  }
  return { resourceType: "image", publicId: storageKey };
};

const resolveCloudinaryDownloadUrl = (storageKey: string): string => {
  if (!isCloudinaryConfigured()) throw new Error("CLOUDINARY_NOT_CONFIGURED");
  const cloudinary = getCloudinary();
  const { resourceType, publicId } = parseCloudinaryReference(storageKey);

  if (/^https?:\/\//i.test(publicId)) {
    console.info("[DR] CLOUDINARY_STORAGEKEY_IS_URL", {
      storageKey,
      publicId,
    });

    console.info("[DR] CLOUDINARY_URL_RESOLVED", {
      storageKey,
      publicId,
      resourceType,
      downloadUrl: publicId,
    });

    return publicId;
  }

  const downloadUrl = cloudinary.url(publicId, {
    resource_type: resolveCloudinaryResourceType(resourceType),
    secure: true,
    flags: "attachment",
  });

  console.info("[DR] CLOUDINARY_STORAGEKEY_IS_PUBLIC_ID", {
    storageKey,
  });

  console.info("[DR] CLOUDINARY_URL_RESOLVED", {
    storageKey,
    publicId,
    resourceType,
    downloadUrl,
  });

  return downloadUrl;
};

const openHttpObjectStream = async (url: string, objectKey: string): Promise<Readable> => {
  if (!isHttpDownloadAllowed(url)) {
    throw new Error("HTTP_DOWNLOAD_NOT_ALLOWED");
  }
  try {
    return await withDrAbortTimeout(
      "httpObjectDownload",
      DR_OBJECT_DOWNLOAD_TIMEOUT_MS,
      async (signal) => {
        logDrObjectDiag("Download started", { objectKey, provider: "http", url });
        const response = await fetch(url, { signal });
        if (!response.ok) {
          throw new Error(`HTTP_DOWNLOAD_FAILED:${response.status}`);
        }
        if (!response.body) {
          throw new Error("HTTP_BODY_EMPTY");
        }
        return webBodyToNodeStream(response.body);
      },
      { objectKey }
    );
  } catch (error) {
    logDrDownloadProviderFailed(
      {
        provider: "http",
        storageKey: url,
        archivePath: objectKey,
        streamName: "http-download",
      },
      error
    );
    throw error;
  }
};

const openCloudinaryObjectStream = async (
  storageKey: string,
  objectKey: string
): Promise<Readable> => {
  const downloadUrl = resolveCloudinaryDownloadUrl(storageKey);
  try {
    return await withDrAbortTimeout(
      "cloudinaryObjectDownload",
      DR_OBJECT_DOWNLOAD_TIMEOUT_MS,
      async (signal) => {
        logDrObjectDiag("Download started", { objectKey, provider: "cloudinary", storageKey });
        console.info("[DR] CLOUDINARY_FETCH_BEGIN", {
          storageKey,
          objectKey,
          downloadUrl,
        });
        const response = await fetch(downloadUrl, { signal });
        console.info("[DR] CLOUDINARY_FETCH_RESPONSE", {
          status: response.status,
          ok: response.ok,
          redirected: response.redirected,
          url: response.url,
          contentType: response.headers.get("content-type"),
          contentLength: response.headers.get("content-length"),
          cacheControl: response.headers.get("cache-control"),
          server: response.headers.get("server"),
          cloudinaryError: response.headers.get("x-cld-error"),
          requestId: response.headers.get("x-request-id"),
        });
        if (!response.ok) {
          const responseBody = await response.text().catch(() => "<body unavailable>");

          console.error("[DR] CLOUDINARY_FETCH_FAILURE", {
            storageKey,
            objectKey,
            downloadUrl,
            status: response.status,
            headers: Object.fromEntries(response.headers.entries()),
            body: responseBody.substring(0, 2000),
          });

          throw new Error(`CLOUDINARY_DOWNLOAD_FAILED:${response.status}`);
        }
        if (!response.body) {
          console.error("[DR] CLOUDINARY_BODY_EMPTY", {
            storageKey,
            objectKey,
            downloadUrl,
          });

          throw new Error("CLOUDINARY_BODY_EMPTY");
        }
        console.info("[DR] CLOUDINARY_STREAM_OPENED", {
          storageKey,
          objectKey,
          downloadUrl,
        });
        return webBodyToNodeStream(response.body);
      },
      { objectKey }
    );
  } catch (error) {
    console.error("[DR] CLOUDINARY_EXCEPTION", {
      storageKey,
      objectKey,
      downloadUrl,
      name: error instanceof Error ? error.name : undefined,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    logDrDownloadProviderFailed(
      {
        provider: "cloudinary",
        storageKey,
        archivePath: objectKey,
        streamName: "cloudinary-download",
      },
      error
    );
    throw error;
  }
};

const openInlineObjectStream = (storageKey: string): Readable => {
  const content = decodeDataUrl(storageKey);
  return Readable.from(content);
};

const openObjectSourceStream = async (entry: StorageManifestEntry): Promise<Readable> => {
  const objectKey = entry.archivePath;
  const context = buildDrObjectStreamContext({ entry, streamName: "object-source" });

  try {
    let stream: Readable;
    if (entry.provider === "r2") {
      stream = await openR2ObjectStream(entry.storageKey, objectKey);
    } else if (entry.provider === "cloudinary") {
      stream = await openCloudinaryObjectStream(entry.storageKey, objectKey);
    } else if (entry.provider === "http") {
      stream = await openHttpObjectStream(entry.storageKey, objectKey);
    } else if (entry.provider === "inline") {
      stream = openInlineObjectStream(entry.storageKey);
    } else {
      throw new Error(`UNSUPPORTED_PROVIDER:${entry.provider}`);
    }

    attachDrObjectStreamErrorLogging(stream, context);
    return stream;
  } catch (error) {
    logDrDownloadProviderFailed(context, error);
    throw error;
  }
};

const downloadR2Object = async (key: string): Promise<Buffer> => {
  logDrBufferFallbackEnter("object-export.downloadR2Object");
  const buffer = await streamToBuffer(await openR2ObjectStream(key, key));
  logDrBufferFallbackExit("object-export.downloadR2Object", buffer.byteLength);
  return buffer;
};

const downloadCloudinaryAsset = async (storageKey: string): Promise<Buffer> => {
  logDrBufferFallbackEnter("object-export.downloadCloudinaryAsset");
  console.info("[DR] CLOUDINARY_BUFFER_DOWNLOAD", {
    storageKey,
  });
  const buffer = await streamToBuffer(await openCloudinaryObjectStream(storageKey, storageKey));
  logDrBufferFallbackExit("object-export.downloadCloudinaryAsset", buffer.byteLength);
  console.info("[DR] CLOUDINARY_BUFFER_COMPLETE", {
    storageKey,
    size: buffer.byteLength,
  });
  return buffer;
};

const downloadHttpAsset = async (url: string): Promise<Buffer> => {
  logDrBufferFallbackEnter("object-export.downloadHttpAsset");
  const buffer = await streamToBuffer(await openHttpObjectStream(url, url));
  logDrBufferFallbackExit("object-export.downloadHttpAsset", buffer.byteLength);
  return buffer;
};

export const exportStorageObjectStream = async (
  entry: StorageManifestEntry
): Promise<ExportedObjectStream> => {
  const sourceStream = await openObjectSourceStream(entry);
  const { stream, completed } = createHashingObjectStream(entry, sourceStream);
  attachDrObjectStreamErrorLogging(stream, buildDrObjectStreamContext({
    entry,
    streamName: "hashing-output",
  }));

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
    console.info("[DR] CLOUDINARY_MANIFEST_ENTRY", {
      archivePath: entry.archivePath,
      provider: entry.provider,
      storageKey: entry.storageKey,
      fileSize: entry.fileSize,
      checksum: entry.checksum,
      fileName: (entry as StorageManifestEntry & { fileName?: string }).fileName,
    });
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
  guards?: DrStreamExportGuards;
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
    guards: input.guards,
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
