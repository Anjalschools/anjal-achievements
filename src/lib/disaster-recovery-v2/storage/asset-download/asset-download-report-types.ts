export type AssetDownloadTerminalStatus = "downloaded" | "skipped" | "missing" | "failed";

export type AssetDownloadReportEntry = {
  objectId: string;
  provider: string;
  storageKey: string;
  publicId: string;
  status: AssetDownloadTerminalStatus;
  relativePath?: string;
  sha256?: string;
  sizeBytes?: number;
  durationMs: number;
  attempts: number;
  retries: number;
  warning?: string;
  failure?: string;
  httpStatus?: number;
};

export type AssetDownloadReport = {
  version: 2;
  generatedAt: string;
  totalAssets: number;
  downloaded: number;
  skipped: number;
  missing: number;
  failed: number;
  retries: number;
  totalBytes: number;
  durationMs: number;
  warnings: string[];
  failures: string[];
  assets: AssetDownloadReportEntry[];
};

export const ASSET_DOWNLOAD_REPORT_VERSION = 2 as const;

export const createEmptyAssetDownloadReport = (): AssetDownloadReport => ({
  version: ASSET_DOWNLOAD_REPORT_VERSION,
  generatedAt: new Date().toISOString(),
  totalAssets: 0,
  downloaded: 0,
  skipped: 0,
  missing: 0,
  failed: 0,
  retries: 0,
  totalBytes: 0,
  durationMs: 0,
  warnings: [],
  failures: [],
  assets: [],
});
