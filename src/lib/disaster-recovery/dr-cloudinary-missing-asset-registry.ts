import type { StorageProviderKind } from "@/lib/disaster-recovery/storage-manifest-types";

export type MissingAssetReason =
  | "download_stalled"
  | "network_failure"
  | "download_timeout"
  | "not_found";

export type MissingAssetRecord = {
  objectKey: string;
  provider: StorageProviderKind;
  publicId: string;
  originalUrl: string;
  failureReason: MissingAssetReason;
  errorCode: string;
  attempts: number;
  bytesReceived: number;
  contentLength: number | null;
  firstFailureAt: string;
  finalFailureAt: string;
};

export type SerializedMissingAsset = {
  objectKey: string;
  provider: StorageProviderKind;
  reason: string;
  attempts: number;
  publicId?: string;
  originalUrl?: string;
  errorCode?: string;
  bytesReceived?: number;
  contentLength?: number | null;
};

const missingAssets: MissingAssetRecord[] = [];

export const resetMissingAssetRegistry = (): void => {
  missingAssets.length = 0;
};

export const recordMissingAsset = (record: MissingAssetRecord): void => {
  missingAssets.push(record);
  console.info("[DR] MISSING_ASSET_RECORDED", {
    objectKey: record.objectKey,
    provider: record.provider,
    failureReason: record.failureReason,
    errorCode: record.errorCode,
    attempts: record.attempts,
    bytesReceived: record.bytesReceived,
    contentLength: record.contentLength,
    firstFailureAt: record.firstFailureAt,
    finalFailureAt: record.finalFailureAt,
  });
};

export const getMissingAssetRecords = (): MissingAssetRecord[] => [...missingAssets];

export const serializeMissingAssets = (): SerializedMissingAsset[] =>
  missingAssets.map((record) => ({
    objectKey: record.objectKey,
    provider: record.provider,
    reason: record.errorCode,
    attempts: record.attempts,
    publicId: record.publicId,
    originalUrl: record.originalUrl,
    errorCode: record.errorCode,
    bytesReceived: record.bytesReceived,
    contentLength: record.contentLength,
  }));
