import "server-only";

import { getDrJobContext } from "@/lib/disaster-recovery/dr-job-context";
import { readProcessMemorySnapshot } from "@/lib/disaster-recovery/dr-memory-metrics";

const SNAPSHOT_INTERVAL_MS = 10_000;

let snapshotTimer: ReturnType<typeof setInterval> | null = null;
let snapshotJobId: string | undefined;
let snapshotStartedAt = 0;

export const emitDrMemorySnapshot = (jobId?: string): void => {
  const ctx = getDrJobContext();
  const memory = readProcessMemorySnapshot();
  console.info("[DR] MEMORY_SNAPSHOT", {
    rss: memory.rss,
    heapUsed: memory.heapUsed,
    heapTotal: memory.heapTotal,
    external: memory.external,
    arrayBuffers: memory.arrayBuffers,
    jobId: jobId ?? snapshotJobId ?? ctx.recordId,
    stage: ctx.phase,
    elapsed: snapshotStartedAt > 0 ? Date.now() - snapshotStartedAt : 0,
  });
};

export const startDrMemorySnapshotTimer = (jobId: string): void => {
  stopDrMemorySnapshotTimer();
  snapshotJobId = jobId;
  snapshotStartedAt = Date.now();
  emitDrMemorySnapshot(jobId);
  snapshotTimer = setInterval(() => emitDrMemorySnapshot(jobId), SNAPSHOT_INTERVAL_MS);
};

export const stopDrMemorySnapshotTimer = (): void => {
  if (snapshotTimer) {
    clearInterval(snapshotTimer);
    snapshotTimer = null;
  }
  snapshotJobId = undefined;
  snapshotStartedAt = 0;
};
