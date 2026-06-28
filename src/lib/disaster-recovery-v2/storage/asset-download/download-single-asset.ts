import { dirname } from "path";

import type { StorageDiscoveryAsset } from "@/lib/disaster-recovery-v2/storage/storage-manifest-types";
import type { AssetDownloadReportEntry } from "@/lib/disaster-recovery-v2/storage/asset-download/asset-download-report-types";
import type { MissingAssetEntry } from "@/lib/disaster-recovery-v2/storage/asset-download/missing-assets-types";
import {
  resolveAssetAbsolutePath,
  resolveAssetTempPath,
} from "@/lib/disaster-recovery-v2/storage/asset-download/asset-download-paths";
import { resolveAssetRelativePath } from "@/lib/disaster-recovery-v2/storage/asset-download/resolve-asset-file-path";
import type { AssetDownloadTransport } from "@/lib/disaster-recovery-v2/storage/asset-download/asset-download-transport";
import {
  AssetDownloadHttpError,
  MAX_ASSET_DOWNLOAD_ATTEMPTS,
  isTransientDownloadError,
  toDownloadFailureReason,
} from "@/lib/disaster-recovery-v2/storage/asset-download/retry-policy";
import { verifyDownloadedAssetFile } from "@/lib/disaster-recovery-v2/storage/asset-download/verify-downloaded-file";
import { logDrV2 } from "@/lib/disaster-recovery-v2/utils/logging";

export type SingleAssetDownloadDependencies = {
  workspaceDir: string;
  jobId: string;
  transport: AssetDownloadTransport;
  ensureDirectory: (directoryPath: string) => Promise<void>;
  renameFile: (sourcePath: string, destinationPath: string) => Promise<void>;
  removeFile: (filePath: string) => Promise<void>;
  statFile: (filePath: string) => Promise<{ size: number }>;
  computeSha256: (filePath: string) => Promise<string>;
  sleep: (durationMs: number) => Promise<void>;
};

export type SingleAssetDownloadResult = {
  reportEntry: AssetDownloadReportEntry;
  missingEntry?: MissingAssetEntry;
  retries: number;
};

const createMissingEntry = (input: {
  asset: StorageDiscoveryAsset;
  reason: string;
  attempts: number;
  httpStatus?: number;
}): MissingAssetEntry => ({
  provider: input.asset.provider,
  storageKey: input.asset.storageKey,
  publicId: input.asset.publicId,
  reason: input.reason,
  attempts: input.attempts,
  httpStatus: input.httpStatus,
  timestamp: new Date().toISOString(),
});

export const downloadSingleAsset = async (
  asset: StorageDiscoveryAsset,
  deps: SingleAssetDownloadDependencies
): Promise<SingleAssetDownloadResult> => {
  const startedAt = Date.now();
  const relativePath = resolveAssetRelativePath(asset);
  const absolutePath = resolveAssetAbsolutePath(deps.workspaceDir, relativePath);
  const tempPath = resolveAssetTempPath(absolutePath);

  logDrV2("ASSET_DOWNLOAD_STARTED", {
    jobId: deps.jobId,
    objectId: asset.objectId,
    storageKey: asset.storageKey,
    relativePath,
  });

  if (!asset.downloadUrl?.trim()) {
    logDrV2("ASSET_DOWNLOAD_SKIPPED", {
      jobId: deps.jobId,
      objectId: asset.objectId,
      reason: "DOWNLOAD_URL_MISSING",
    });

    return {
      reportEntry: {
        objectId: asset.objectId,
        provider: asset.provider,
        storageKey: asset.storageKey,
        publicId: asset.publicId,
        status: "skipped",
        durationMs: Date.now() - startedAt,
        attempts: 0,
        retries: 0,
        warning: "DOWNLOAD_URL_MISSING",
      },
      retries: 0,
    };
  }

  let attempts = 0;
  let retries = 0;
  let lastError: unknown;
  let lastHttpStatus: number | undefined;

  while (attempts < MAX_ASSET_DOWNLOAD_ATTEMPTS) {
    attempts += 1;
    const abortController = new AbortController();

    try {
      await deps.ensureDirectory(dirname(absolutePath));
      await deps.removeFile(tempPath).catch(() => undefined);

      const downloadResult = await deps.transport.download({
        url: asset.downloadUrl,
        tempPath,
        signal: abortController.signal,
      });

      const verified = await verifyDownloadedAssetFile({
        filePath: tempPath,
        expectedBytes: asset.bytes,
        contentLength: downloadResult.contentLength,
        statFile: deps.statFile,
        computeSha256: deps.computeSha256,
      });

      await deps.renameFile(tempPath, absolutePath);

      logDrV2("ASSET_VERIFIED", {
        jobId: deps.jobId,
        objectId: asset.objectId,
        relativePath,
        sizeBytes: verified.sizeBytes,
        sha256: verified.sha256,
      });

      logDrV2("ASSET_DOWNLOAD_COMPLETED", {
        jobId: deps.jobId,
        objectId: asset.objectId,
        relativePath,
        attempts,
        retries,
        durationMs: Date.now() - startedAt,
      });

      abortController.abort();

      return {
        reportEntry: {
          objectId: asset.objectId,
          provider: asset.provider,
          storageKey: asset.storageKey,
          publicId: asset.publicId,
          status: "downloaded",
          relativePath,
          sha256: verified.sha256,
          sizeBytes: verified.sizeBytes,
          durationMs: Date.now() - startedAt,
          attempts,
          retries,
        },
        retries,
      };
    } catch (error) {
      lastError = error;
      lastHttpStatus = error instanceof AssetDownloadHttpError ? error.httpStatus : undefined;
      await deps.removeFile(tempPath).catch(() => undefined);
      abortController.abort();

      if (error instanceof AssetDownloadHttpError && error.missing) {
        const reason = toDownloadFailureReason(error);
        logDrV2("ASSET_DOWNLOAD_COMPLETED", {
          jobId: deps.jobId,
          objectId: asset.objectId,
          status: "missing",
          attempts,
          httpStatus: error.httpStatus,
        });

        return {
          reportEntry: {
            objectId: asset.objectId,
            provider: asset.provider,
            storageKey: asset.storageKey,
            publicId: asset.publicId,
            status: "missing",
            durationMs: Date.now() - startedAt,
            attempts,
            retries,
            failure: reason,
            httpStatus: error.httpStatus,
          },
          missingEntry: createMissingEntry({
            asset,
            reason,
            attempts,
            httpStatus: error.httpStatus,
          }),
          retries,
        };
      }

      const canRetry = isTransientDownloadError(error) && attempts < MAX_ASSET_DOWNLOAD_ATTEMPTS;
      if (canRetry) {
        retries += 1;
        logDrV2("ASSET_DOWNLOAD_RETRY", {
          jobId: deps.jobId,
          objectId: asset.objectId,
          attempt: attempts,
          nextAttempt: attempts + 1,
          reason: toDownloadFailureReason(error),
        });
        await deps.sleep(0);
        continue;
      }

      break;
    }
  }

  const reason = toDownloadFailureReason(lastError);

  logDrV2("ASSET_DOWNLOAD_COMPLETED", {
    jobId: deps.jobId,
    objectId: asset.objectId,
    status: "failed",
    attempts,
    reason,
  });

  const reportEntry: AssetDownloadReportEntry = {
    objectId: asset.objectId,
    provider: asset.provider,
    storageKey: asset.storageKey,
    publicId: asset.publicId,
    status: "failed",
    durationMs: Date.now() - startedAt,
    attempts,
    retries,
    failure: reason,
    httpStatus: lastHttpStatus,
  };

  return {
    reportEntry,
    missingEntry:
      lastHttpStatus !== undefined && (lastHttpStatus === 404 || lastHttpStatus === 410)
        ? createMissingEntry({
            asset,
            reason,
            attempts,
            httpStatus: lastHttpStatus,
          })
        : undefined,
    retries,
  };
};
