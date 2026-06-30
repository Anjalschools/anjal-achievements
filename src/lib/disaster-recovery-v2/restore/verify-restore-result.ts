import type {
  RestoreAssetResult,
  RestoreCollectionResult,
  RestoreReport,
  RestoreVerificationSummary,
} from "@/lib/disaster-recovery-v2/restore/restore-report-types";

import type { R2RestoreResult } from "@/lib/disaster-recovery-v2/object-storage/r2-restore";

export const buildRestoreVerificationSummary = (input: {
  collectionResults: RestoreCollectionResult[];
  assetResults: RestoreAssetResult[];
  r2RestoreResult?: R2RestoreResult;
}): RestoreVerificationSummary => {
  const restoredCollections = input.collectionResults.filter((entry) => entry.status === "restored").length;
  const failedCollections = input.collectionResults.filter((entry) => entry.status === "failed").length;
  const restoredAssets = input.assetResults.filter((entry) => entry.status === "restored").length;
  const skippedAssets = input.assetResults.filter((entry) => entry.status === "skipped").length;
  const failedAssets = input.assetResults.filter((entry) => entry.status === "failed").length;
  const restoredR2Objects = input.r2RestoreResult?.restored ?? 0;
  const failedR2Objects = input.r2RestoreResult?.failed ?? 0;

  return {
    expectedCollections: input.collectionResults.length,
    restoredCollections,
    failedCollections,
    expectedAssets: input.assetResults.length,
    restoredAssets,
    skippedAssets,
    failedAssets,
    restoredR2Objects,
    failedR2Objects,
    verified: failedCollections === 0 && failedAssets === 0 && failedR2Objects === 0,
  };
};

export const verifyRestoreOutcome = (input: {
  collectionResults: RestoreCollectionResult[];
  assetResults: RestoreAssetResult[];
  r2RestoreResult?: R2RestoreResult;
}): RestoreVerificationSummary => {
  const summary = buildRestoreVerificationSummary(input);

  if (summary.failedCollections > 0 || summary.failedAssets > 0) {
    return summary;
  }

  return {
    ...summary,
    verified: true,
  };
};

export const buildRestoreReport = (input: {
  jobId: string;
  restoreMode: string;
  backupZipPath: string;
  durationMs: number;
  collectionResults: RestoreCollectionResult[];
  assetResults: RestoreAssetResult[];
  verification: RestoreVerificationSummary;
}): RestoreReport => {
  const warnings = [
    ...input.assetResults
      .filter((entry) => entry.status === "skipped")
      .map((entry) => `${entry.objectId}: ${entry.error ?? "SKIPPED"}`),
  ].sort((left, right) => left.localeCompare(right));

  const errors = [
    ...input.collectionResults
      .filter((entry) => entry.status === "failed")
      .map((entry) => `${entry.name}: ${entry.error ?? "FAILED"}`),
    ...input.assetResults
      .filter((entry) => entry.status === "failed")
      .map((entry) => `${entry.objectId}: ${entry.error ?? "FAILED"}`),
  ].sort((left, right) => left.localeCompare(right));

  return {
    version: 2,
    generatedAt: new Date().toISOString(),
    jobId: input.jobId,
    restoreMode: input.restoreMode,
    backupZipPath: input.backupZipPath,
    durationMs: input.durationMs,
    collections: input.collectionResults,
    assets: input.assetResults,
    verification: input.verification,
    warnings,
    errors,
  };
};
