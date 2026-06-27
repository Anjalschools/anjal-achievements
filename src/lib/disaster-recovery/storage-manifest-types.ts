import { serializeMissingAssets } from "@/lib/disaster-recovery/dr-cloudinary-missing-asset-registry";

export const STORAGE_MANIFEST_VERSION = "11.2";

export type StorageProviderKind = "r2" | "cloudinary" | "http" | "inline";

export type StorageManifestEntryStatus =
  | "pending"
  | "exported"
  | "missing"
  | "failed"
  | "skipped";

export type StorageManifestEntry = {
  id: string;
  provider: StorageProviderKind;
  storageKey: string;
  archivePath: string;
  fileSize?: number;
  mimeType?: string;
  checksum?: string;
  sourceCollection: string;
  sourceDocumentId: string;
  sourceField: string;
  status: StorageManifestEntryStatus;
  errorMessage?: string;
};

export type StorageManifest = {
  version: string;
  createdAt: string;
  objectCount: number;
  exportedCount: number;
  missingCount: number;
  failedCount: number;
  totalBytes: number;
  entries: StorageManifestEntry[];
  missingAssets?: Array<{
    objectKey: string;
    provider: StorageProviderKind;
    reason: string;
    attempts: number;
    publicId?: string;
    originalUrl?: string;
    errorCode?: string;
    bytesReceived?: number;
    contentLength?: number | null;
  }>;
};

export const serializeStorageManifest = (manifest: StorageManifest): string => {
  const missingAssets = serializeMissingAssets();
  const payload =
    missingAssets.length > 0 ? { ...manifest, missingAssets } : manifest;
  return `${JSON.stringify(payload, null, 2)}\n`;
};

export const parseStorageManifest = (raw: string): StorageManifest => {
  const parsed = JSON.parse(raw) as StorageManifest;
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.entries)) {
    throw new Error("STORAGE_MANIFEST_INVALID");
  }
  return parsed;
};
