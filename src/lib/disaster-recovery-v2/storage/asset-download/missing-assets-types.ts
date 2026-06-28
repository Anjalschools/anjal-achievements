export type MissingAssetEntry = {
  provider: string;
  storageKey: string;
  publicId: string;
  reason: string;
  attempts: number;
  httpStatus?: number;
  timestamp: string;
};

export type MissingAssetsManifest = {
  version: 2;
  generatedAt: string;
  entries: MissingAssetEntry[];
};

export const MISSING_ASSETS_MANIFEST_VERSION = 2 as const;

export const createEmptyMissingAssetsManifest = (): MissingAssetsManifest => ({
  version: MISSING_ASSETS_MANIFEST_VERSION,
  generatedAt: new Date().toISOString(),
  entries: [],
});
