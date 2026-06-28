import type {
  RestoreAssetResult,
  RestoreCollectionResult,
  RestoreReport,
  RestoreVerificationSummary,
} from "@/lib/disaster-recovery-v2/restore/restore-report-types";

export const buildRestoreVerificationSummary = (input: {
  collectionResults: RestoreCollectionResult[];
  assetResults: RestoreAssetResult[];
}): RestoreVerificationSummary => {
  const restoredCollections = input.collectionResults.filter((entry) => entry.status === "restored").length;
  const failedCollections = input.collectionResults.filter((entry) => entry.status === "failed").length;
  const restoredAssets = input.assetResults.filter((entry) => entry.status === "restored").length;
  const skippedAssets = input.assetResults.filter((entry) => entry.status === "skipped").length;
  const failedAssets = input.assetResults.filter((entry) => entry.status === "failed").length;

  return {
    expectedCollections: input.collectionResults.length,
    restoredCollections,
    failedCollections,
    expectedAssets: input.assetResults.length,
    restoredAssets,
    skippedAssets,
    failedAssets,
    verified: failedCollections === 0 && failedAssets === 0,
  };
};

export const verifyRestoreOutcome = (input: {
  collectionResults: RestoreCollectionResult[];
  assetResults: RestoreAssetResult[];
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
