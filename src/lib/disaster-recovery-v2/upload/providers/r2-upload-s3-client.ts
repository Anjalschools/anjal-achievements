import { S3Client, type S3ClientConfig } from "@aws-sdk/client-s3";

import {
  createOrGetR2S3Client,
  type ResolvedR2S3Settings,
} from "@/lib/storage/r2-config";

/**
 * DR.V2 large backup uploads must not use the default S3 client checksum behavior.
 * `WHEN_SUPPORTED` auto-injects CRC32 on PutObject and wraps streams in aws-chunked
 * encoding, which inflates external/arrayBuffers memory on Render (~200 MB+ for 1 GB files).
 */
export const buildDrV2R2UploadS3ClientConfig = (
  settings: ResolvedR2S3Settings
): S3ClientConfig => ({
  region: "auto",
  endpoint: settings.endpoint,
  credentials: settings.credentials,
  forcePathStyle: true,
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

let cachedUploadClient: S3Client | null = null;
let cachedFingerprint = "";

const fingerprint = (settings: ResolvedR2S3Settings): string =>
  `${settings.endpoint}|${settings.bucket}|${settings.credentials.accessKeyId}|WHEN_REQUIRED`;

export const createOrGetDrV2R2UploadS3Client = (): {
  client: S3Client;
  settings: ResolvedR2S3Settings;
} => {
  const { settings } = createOrGetR2S3Client();
  const fp = fingerprint(settings);

  if (!cachedUploadClient || fp !== cachedFingerprint) {
    cachedUploadClient = new S3Client(buildDrV2R2UploadS3ClientConfig(settings));
    cachedFingerprint = fp;
  }

  return { client: cachedUploadClient, settings };
};

/** Test-only reset for client cache isolation. */
export const resetDrV2R2UploadS3ClientCacheForTests = (): void => {
  cachedUploadClient = null;
  cachedFingerprint = "";
};
