import "server-only";

import connectDB from "@/lib/mongodb";
import BackupRecord from "@/models/BackupRecord";
import { requestDrJobCancellation } from "@/lib/disaster-recovery/dr-known-jobs";

export const isDrJobCancelRequested = async (recordId: string): Promise<boolean> => {
  await connectDB();
  const row = await BackupRecord.findById(recordId).select("cancelRequested status").lean();
  if (!row) return false;
  return row.status === "pending" && row.cancelRequested === true;
};

export { requestDrJobCancellation };
