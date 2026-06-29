import "server-only";
import { PassThrough, Readable } from "stream";
import { getR2BucketName, isR2Configured } from "@/lib/r2";
import { sendR2PutObject } from "@/lib/disaster-recovery/dr-r2-sdk";
import type { BackupRetrieveStreamResult } from "@/lib/backup/backup-download-types";
import { openR2BackupObjectReadStream } from "@/lib/backup/r2-backup-download-client";
import type { BackupStorageProviderId } from "@/lib/backup/backup-constants";

export type StoredBackupArtifact = {
  provider: BackupStorageProviderId;
  storageKey?: string;
  fileName: string;
  sizeBytes: number;
  downloadUrl?: string;
  bucket?: string;
  etag?: string;
};

export type BackupStorageProvider = {
  id: BackupStorageProviderId;
  store: (input: {
    fileName: string;
    body: Buffer;
    contentType?: string;
  }) => Promise<StoredBackupArtifact>;
  storeStream?: (input: {
    fileName: string;
    body: Readable;
    contentType?: string;
  }) => Promise<StoredBackupArtifact>;
  retrieveStream: (storageKey: string, abortSignal?: AbortSignal) => Promise<BackupRetrieveStreamResult>;
  retrieve: (storageKey: string) => Promise<Buffer>;
};

const streamToBuffer = async (stream: Readable): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

export const createLocalBackupStorageProvider = (): BackupStorageProvider => ({
  id: "local",
  store: async ({ fileName, body }) => ({
    provider: "local",
    fileName,
    sizeBytes: body.byteLength,
  }),
  retrieveStream: async () => {
    throw new Error("LOCAL_STORAGE_RETRIEVE_UNSUPPORTED");
  },
  retrieve: async () => {
    throw new Error("LOCAL_STORAGE_RETRIEVE_UNSUPPORTED");
  },
});

export const createR2BackupStorageProvider = (): BackupStorageProvider => ({
  id: "r2",
  store: async ({ fileName, body, contentType = "application/zip" }) => {
    if (!isR2Configured()) {
      throw new Error("R2_NOT_CONFIGURED");
    }
    const key = `backups/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${fileName}`;
    const bucket = getR2BucketName();
    const response = await sendR2PutObject({
      key,
      body,
      contentType,
    });
    return {
      provider: "r2",
      storageKey: key,
      fileName,
      sizeBytes: body.byteLength,
      bucket,
      etag: response.ETag,
    };
  },
  storeStream: async ({ fileName, body, contentType = "application/zip" }) => {
    if (!isR2Configured()) {
      throw new Error("R2_NOT_CONFIGURED");
    }

    const key = `backups/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${fileName}`;
    const bucket = getR2BucketName();

    console.info("[DR] R2_UPLOAD_START", {
      key,
      readableFlowing: body.readableFlowing,
      readableEnded: body.readableEnded,
      destroyed: body.destroyed,
    });

    const response = await sendR2PutObject({
      key,
      body,
      contentType,
      uploadBody: body,
    });

    console.info("[DR] R2_UPLOAD_COMPLETED", {
      key,
      etag: response.ETag,
    });

    return {
      provider: "r2",
      storageKey: key,
      fileName,
      sizeBytes: 0,
      bucket,
      etag: response.ETag,
    };
  },

  retrieveStream: async (storageKey: string, abortSignal?: AbortSignal) => {
    if (!isR2Configured()) {
      throw new Error("R2_NOT_CONFIGURED");
    }
    const opened = await openR2BackupObjectReadStream({
      key: storageKey,
      abortSignal,
    });
    return {
      stream: opened.body,
      contentLength: opened.contentLength,
      etag: opened.etag,
    };
  },

  retrieve: async (storageKey: string) => {
    const opened = await openR2BackupObjectReadStream({ key: storageKey });
    return streamToBuffer(opened.body);
  },
});

export const resolveBackupStorageProvider = (
  providerId: BackupStorageProviderId
): BackupStorageProvider => {
  if (providerId === "r2") return createR2BackupStorageProvider();
  return createLocalBackupStorageProvider();
};

export const bufferToDownloadStream = (buffer: Buffer): Readable => {
  const stream = new PassThrough();
  stream.end(buffer);
  return stream;
};
