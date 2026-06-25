import "server-only";
import { PassThrough, Readable } from "stream";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getR2BucketName, getR2Client, isR2Configured } from "@/lib/r2";
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
    const client = getR2Client();
    const bucket = getR2BucketName();
    const response = await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    );
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
    const client = getR2Client();
    const bucket = getR2BucketName();
  
    console.info("[DR] R2_UPLOAD_START", {
      key,
      readableFlowing: body.readableFlowing,
      readableEnded: body.readableEnded,
      destroyed: body.destroyed,
    });
  
    const response = await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    );
  
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
  
  retrieve: async (storageKey: string) => {
    if (!isR2Configured()) {
      throw new Error("R2_NOT_CONFIGURED");
    }
    const client = getR2Client();
    const response = await client.send(
      new GetObjectCommand({
        Bucket: getR2BucketName(),
        Key: storageKey,
      })
    );
    if (!response.Body) throw new Error("R2_OBJECT_EMPTY");
    return streamToBuffer(response.Body as Readable);
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
