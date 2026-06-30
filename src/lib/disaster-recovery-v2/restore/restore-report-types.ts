export type RestoreCollectionResult = {
  name: string;
  status: "restored" | "failed";
  documentCount: number;
  durationMs: number;
  error?: string;
};

export type RestoreAssetTerminalStatus = "restored" | "skipped" | "failed";

export type RestoreAssetResult = {
  objectId: string;
  provider: string;
  publicId: string;
  storageKey: string;
  status: RestoreAssetTerminalStatus;
  durationMs: number;
  error?: string;
};

export type RestoreVerificationSummary = {
  expectedCollections: number;
  restoredCollections: number;
  failedCollections: number;
  expectedAssets: number;
  restoredAssets: number;
  skippedAssets: number;
  failedAssets: number;
  restoredR2Objects?: number;
  failedR2Objects?: number;
  verified: boolean;
};

export type RestoreReport = {
  version: 2;
  generatedAt: string;
  jobId: string;
  restoreMode: string;
  backupZipPath: string;
  durationMs: number;
  collections: RestoreCollectionResult[];
  assets: RestoreAssetResult[];
  verification: RestoreVerificationSummary;
  warnings: string[];
  errors: string[];
};

export const RESTORE_REPORT_VERSION = 2 as const;

export type RestoreEngineResult = {
  success: boolean;
  jobId: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  reportPath: string;
  report: RestoreReport;
};
