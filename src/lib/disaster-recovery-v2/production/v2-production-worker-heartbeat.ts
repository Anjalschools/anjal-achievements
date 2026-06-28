import "server-only";

import connectDB from "@/lib/mongodb";
import BackupRecord from "@/models/BackupRecord";

export const touchV2ProductionWorkerHeartbeat = async (input: {
  recordId: string;
  workerId: string;
}): Promise<void> => {
  await connectDB();
  await BackupRecord.findByIdAndUpdate(input.recordId, {
    heartbeatAt: new Date(),
    workerId: input.workerId,
  });
};
