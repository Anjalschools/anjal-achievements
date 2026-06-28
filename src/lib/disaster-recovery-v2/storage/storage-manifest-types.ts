export type StorageDiscoveryAsset = {
  objectId: string;
  provider: string;
  publicId: string;
  storageKey: string;
  downloadUrl?: string;
  contentType?: string;
  bytes?: number;
  createdAt?: string;
  updatedAt?: string;
  checksumAvailable: boolean;
  metadata?: Record<string, unknown>;
  tags?: string[];
  folder?: string;
  version?: number | string;
};

export type StorageDuplicateWarning = {
  storageKey: string;
  objectIds: string[];
};

export type StorageProviderSummary = {
  provider: string;
  required: boolean;
  success: boolean;
  objectCount: number;
  errorCode?: string;
  message?: string;
  durationMs: number;
};

export type StorageManifest = {
  version: 2;
  generatedAt: string;
  objectCount: number;
  totalBytes: number;
  objects: StorageDiscoveryAsset[];
  duplicateWarnings: StorageDuplicateWarning[];
  providerSummaries: StorageProviderSummary[];
};

export const STORAGE_MANIFEST_VERSION = 2 as const;

export const createEmptyStorageManifest = (): StorageManifest => ({
  version: STORAGE_MANIFEST_VERSION,
  generatedAt: new Date().toISOString(),
  objectCount: 0,
  totalBytes: 0,
  objects: [],
  duplicateWarnings: [],
  providerSummaries: [],
});
