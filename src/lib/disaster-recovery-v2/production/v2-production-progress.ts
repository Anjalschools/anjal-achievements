import "server-only";

import connectDB from "@/lib/mongodb";
import BackupRecord from "@/models/BackupRecord";
import type { V2ProductionJobPhase } from "@/lib/disaster-recovery-v2/production/v2-production-stage-mapping";

export type V2ProductionProgressUpdate = {
  jobPhase: V2ProductionJobPhase;
  processedObjects?: number;
  totalObjects?: number;
  bytesExported?: number;
  workerId?: string;
  heartbeatAt?: Date;
};

export const persistV2ProductionProgress = async (
  recordId: string,
  update: V2ProductionProgressUpdate
): Promise<void> => {
  await connectDB();
  await BackupRecord.findByIdAndUpdate(recordId, {
    jobPhase: update.jobPhase,
    ...(update.processedObjects !== undefined
      ? { processedObjects: update.processedObjects }
      : {}),
    ...(update.totalObjects !== undefined ? { totalObjects: update.totalObjects } : {}),
    ...(update.bytesExported !== undefined ? { bytesExported: update.bytesExported } : {}),
    ...(update.workerId !== undefined ? { workerId: update.workerId } : {}),
    heartbeatAt: update.heartbeatAt ?? new Date(),
  });
};
