import { GetObjectCommand, S3Client, type S3ClientConfig } from "@aws-sdk/client-s3";
import type { Readable } from "stream";

import {
  createOrGetR2S3Client,
  type ResolvedR2S3Settings,
} from "@/lib/storage/r2-config";

/**
 * DR backup downloads must not use default response checksum validation that
 * can buffer large GetObject bodies in memory on constrained hosts.
 */
export const buildR2BackupDownloadS3ClientConfig = (
  settings: ResolvedR2S3Settings
): S3ClientConfig => ({
  region: "auto",
  endpoint: settings.endpoint,
  credentials: settings.credentials,
  forcePathStyle: true,
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

let cachedDownloadClient: S3Client | null = null;
let cachedFingerprint = "";

const fingerprint = (settings: ResolvedR2S3Settings): string =>
  `${settings.endpoint}|${settings.bucket}|${settings.credentials.accessKeyId}|download|WHEN_REQUIRED`;

export const createOrGetR2BackupDownloadS3Client = (): {
  client: S3Client;
  settings: ResolvedR2S3Settings;
} => {
  const { settings } = createOrGetR2S3Client();
  const fp = fingerprint(settings);

  if (!cachedDownloadClient || fp !== cachedFingerprint) {
    cachedDownloadClient = new S3Client(buildR2BackupDownloadS3ClientConfig(settings));
    cachedFingerprint = fp;
  }

  return { client: cachedDownloadClient, settings };
};

export const resetR2BackupDownloadS3ClientCacheForTests = (): void => {
  cachedDownloadClient = null;
  cachedFingerprint = "";
};

export const openR2BackupObjectReadStream = async (input: {
  key: string;
  abortSignal?: AbortSignal;
}): Promise<{
  body: Readable;
  contentLength?: number;
  etag?: string;
}> => {
  const { client, settings } = createOrGetR2BackupDownloadS3Client();
  const response = await client.send(
    new GetObjectCommand({
      Bucket: settings.bucket,
      Key: input.key.replace(/^\/+/, ""),
    }),
    input.abortSignal ? { abortSignal: input.abortSignal } : undefined
  );

  const body = response.Body;
  if (!body || typeof (body as Readable).pipe !== "function") {
    throw new Error("R2_OBJECT_EMPTY");
  }

  return {
    body: body as Readable,
    contentLength: response.ContentLength,
    etag: response.ETag,
  };
};
