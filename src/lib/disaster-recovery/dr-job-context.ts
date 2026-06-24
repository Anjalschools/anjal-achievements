import "server-only";
import type { DrBackupStage } from "@/lib/disaster-recovery/dr-backup-logging";

export type DrJobContext = {
  recordId?: string;
  phase: DrBackupStage | "queued" | "complete" | "failed" | "idle";
  processedObjects: number;
  archivePointer: number;
  totalObjects: number;
};

let currentContext: DrJobContext = {
  phase: "idle",
  processedObjects: 0,
  archivePointer: 0,
  totalObjects: 0,
};

export const resetDrJobContext = (partial?: Partial<DrJobContext>): void => {
  currentContext = {
    phase: "idle",
    processedObjects: 0,
    archivePointer: 0,
    totalObjects: 0,
    ...partial,
  };
};

export const updateDrJobContext = (partial: Partial<DrJobContext>): void => {
  currentContext = { ...currentContext, ...partial };
};

export const getDrJobContext = (): DrJobContext => ({ ...currentContext });
