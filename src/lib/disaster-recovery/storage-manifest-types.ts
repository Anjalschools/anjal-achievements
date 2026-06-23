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
};

export const serializeStorageManifest = (manifest: StorageManifest): string =>
  `${JSON.stringify(manifest, null, 2)}\n`;

export const parseStorageManifest = (raw: string): StorageManifest => {
  const parsed = JSON.parse(raw) as StorageManifest;
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.entries)) {
    throw new Error("STORAGE_MANIFEST_INVALID");
  }
  return parsed;
};
