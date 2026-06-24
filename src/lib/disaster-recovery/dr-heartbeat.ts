import "server-only";
import { readProcessMemorySnapshot } from "@/lib/disaster-recovery/dr-memory-metrics";
import { getDrJobContext, updateDrJobContext } from "@/lib/disaster-recovery/dr-job-context";
import connectDB from "@/lib/mongodb";
import BackupRecord from "@/models/BackupRecord";

const HEARTBEAT_MS = 30_000;

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

const persistJobProgress = async (recordId: string | undefined): Promise<void> => {
  if (!recordId) return;
  const ctx = getDrJobContext();
  try {
    await connectDB();
    await BackupRecord.findByIdAndUpdate(recordId, {
      jobPhase: ctx.phase,
      processedObjects: ctx.processedObjects,
      archivePointer: ctx.archivePointer,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[DR] HEARTBEAT persist failed", { recordId, message });
  }
};

const emitHeartbeat = (): void => {
  const ctx = getDrJobContext();
  const memory = readProcessMemorySnapshot();
  console.log("[DR] HEARTBEAT", {
    phase: ctx.phase,
    processedObjects: ctx.processedObjects,
    totalObjects: ctx.totalObjects,
    archivePointer: ctx.archivePointer,
    recordId: ctx.recordId,
    rss: memory.rss,
    heapUsed: memory.heapUsed,
    heapTotal: memory.heapTotal,
    external: memory.external,
    arrayBuffers: memory.arrayBuffers,
  });
  void persistJobProgress(ctx.recordId);
};

export const startDrHeartbeat = (recordId: string): void => {
  stopDrHeartbeat();
  updateDrJobContext({ recordId });
  emitHeartbeat();
  heartbeatTimer = setInterval(emitHeartbeat, HEARTBEAT_MS);
};

export const stopDrHeartbeat = (): void => {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
};
