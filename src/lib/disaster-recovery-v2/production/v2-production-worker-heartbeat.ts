import "server-only";

import connectDB from "@/lib/mongodb";
import BackupRecord from "@/models/BackupRecord";
import { getV2MemoryDiagnosticsSnapshot } from "@/lib/disaster-recovery-v2/diagnostics/v2-memory-diagnostics";
import { logDrV2 } from "@/lib/disaster-recovery-v2/utils/logging";

export const touchV2ProductionWorkerHeartbeat = async (input: {
  recordId: string;
  workerId: string;
}): Promise<void> => {
  const diagnostics = getV2MemoryDiagnosticsSnapshot();
  const elapsedTimeMs =
    diagnostics.jobStartedAt !== undefined ? Date.now() - diagnostics.jobStartedAt : undefined;

  logDrV2("WORKER_HEARTBEAT", {
    jobId: input.recordId,
    workerId: input.workerId,
    currentStage: diagnostics.currentStage,
    lastCompletedStage: diagnostics.lastCompletedStage,
    peakRSS: diagnostics.peaks.peakRSS,
    peakHeap: diagnostics.peaks.peakHeap,
    peakExternal: diagnostics.peaks.peakExternal,
    peakArrayBuffers: diagnostics.peaks.peakArrayBuffers,
    elapsedTimeMs,
  });

  await connectDB();
  await BackupRecord.findByIdAndUpdate(input.recordId, {
    heartbeatAt: new Date(),
    workerId: input.workerId,
  });
};
