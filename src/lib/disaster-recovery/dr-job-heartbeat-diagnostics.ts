import "server-only";

import { getDrJobContext } from "@/lib/disaster-recovery/dr-job-context";
import { readProcessMemorySnapshot } from "@/lib/disaster-recovery/dr-memory-metrics";

export const logDrJobHeartbeat = (input: {
  jobId?: string;
  processedObjects: number;
  remainingObjects: number;
  elapsed: number;
}): void => {
  const memory = readProcessMemorySnapshot();
  const ctx = getDrJobContext();
  console.info("[DR] JOB_HEARTBEAT", {
    jobId: input.jobId ?? ctx.recordId,
    processedObjects: input.processedObjects,
    remainingObjects: input.remainingObjects,
    elapsed: input.elapsed,
    pid: process.pid,
    rss: memory.rss,
  });
};
