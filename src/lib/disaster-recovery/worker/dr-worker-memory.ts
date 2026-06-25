import "server-only";

import { emitDrMemorySnapshot } from "@/lib/disaster-recovery/dr-memory-snapshot-timer";
import { persistDrWorkerProgress } from "@/lib/disaster-recovery/worker/dr-worker-progress";

export const writeDrWorkerMemorySnapshot = async (recordId: string): Promise<void> => {
  emitDrMemorySnapshot(recordId);
  await persistDrWorkerProgress(recordId);
};
