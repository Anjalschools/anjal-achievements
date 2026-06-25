import "server-only";

import { logDrJobHeartbeat } from "@/lib/disaster-recovery/dr-job-heartbeat-diagnostics";
import { getDrJobContext } from "@/lib/disaster-recovery/dr-job-context";
import { persistDrWorkerProgress } from "@/lib/disaster-recovery/worker/dr-worker-progress";
import { touchDrWorkerJobLock } from "@/lib/disaster-recovery/worker/dr-worker-lock";
import { isDrJobCancelRequested } from "@/lib/disaster-recovery/worker/dr-worker-cancel";

export class DrJobCancelledError extends Error {
  constructor(recordId: string) {
    super(`DR_JOB_CANCELLED:${recordId}`);
    this.name = "DrJobCancelledError";
  }
}

export const emitDrWorkerObjectHeartbeat = async (input: {
  recordId: string;
  workerId: string;
  processedObjects: number;
  remainingObjects: number;
  elapsed: number;
}): Promise<void> => {
  logDrJobHeartbeat({
    jobId: input.recordId,
    processedObjects: input.processedObjects,
    remainingObjects: input.remainingObjects,
    elapsed: input.elapsed,
  });

  await persistDrWorkerProgress(input.recordId, {
    processedObjects: input.processedObjects,
    totalObjects: input.processedObjects + input.remainingObjects,
  });
  await touchDrWorkerJobLock(input.recordId, input.workerId);
};

export const assertDrJobNotCancelled = async (recordId: string): Promise<void> => {
  if (await isDrJobCancelRequested(recordId)) {
    throw new DrJobCancelledError(recordId);
  }
};

export const persistDrWorkerIntervalHeartbeat = async (
  recordId: string,
  workerId: string
): Promise<void> => {
  const ctx = getDrJobContext();
  const elapsed = ctx.startedAtMs ? Date.now() - ctx.startedAtMs : 0;
  await persistDrWorkerProgress(recordId, {
    processedObjects: ctx.processedObjects,
    totalObjects: ctx.totalObjects,
    archivePointer: ctx.archivePointer,
    jobElapsedMs: elapsed,
  });
  await touchDrWorkerJobLock(recordId, workerId);
};
