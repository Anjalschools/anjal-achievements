import type { R2RestoreResult } from "@/lib/disaster-recovery-v2/object-storage/r2-restore";
import { logDrV2 } from "@/lib/disaster-recovery-v2/utils/logging";

export const executeR2ObjectRestoreStage = async (input: {
  extractedRootDir: string;
  jobId: string;
}): Promise<R2RestoreResult> => {
  logDrV2("R2_RESTORE_STARTED", { jobId: input.jobId });

  const { restoreR2ObjectsFromExtractedPackage } = await import(
    "@/lib/disaster-recovery-v2/object-storage/r2-restore"
  );

  const result = await restoreR2ObjectsFromExtractedPackage({
    extractedRootDir: input.extractedRootDir,
    jobId: input.jobId,
  });

  if (result.skipped) {
    logDrV2("R2_RESTORE_SKIPPED", { jobId: input.jobId, reason: "NO_R2_MANIFEST" });
    return result;
  }

  if (result.failed > 0) {
    throw new Error(`R2_RESTORE_FAILED:${result.failed}`);
  }

  logDrV2("R2_OBJECTS_RESTORED", {
    jobId: input.jobId,
    restored: result.restored,
    skipped: result.skippedCount,
  });

  return result;
};
