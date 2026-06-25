import "server-only";

import connectDB from "@/lib/mongodb";
import BackupRecord from "@/models/BackupRecord";
import { getDrJobContext } from "@/lib/disaster-recovery/dr-job-context";
import { readProcessMemorySnapshot } from "@/lib/disaster-recovery/dr-memory-metrics";
import {
  canTransitionDrWorkerPhase,
  mapInternalStageToWorkerPhase,
  type DrWorkerJobPhase,
} from "@/lib/disaster-recovery/worker/dr-worker-state";

let activeRecordId: string | undefined;
let activeWorkerPhase: DrWorkerJobPhase = "queued";
let activeStartedAtMs = 0;

export const bindDrWorkerProgress = (recordId: string): void => {
  activeRecordId = recordId;
  activeWorkerPhase = "queued";
  activeStartedAtMs = Date.now();
};

export const resetDrWorkerProgress = (): void => {
  activeRecordId = undefined;
  activeWorkerPhase = "queued";
  activeStartedAtMs = 0;
};

export const getActiveDrWorkerPhase = (): DrWorkerJobPhase => activeWorkerPhase;

export const persistDrWorkerProgress = async (
  recordId: string,
  partial?: {
    jobPhase?: DrWorkerJobPhase;
    processedObjects?: number;
    totalObjects?: number;
    archivePointer?: number;
    bytesExported?: number;
    workerId?: string;
    heartbeatAt?: Date;
    jobElapsedMs?: number;
    jobMemoryRss?: number;
    jobHeapUsed?: number;
  }
): Promise<void> => {
  const ctx = getDrJobContext();
  const memory = readProcessMemorySnapshot();
  const elapsed = activeStartedAtMs > 0 ? Date.now() - activeStartedAtMs : 0;
  const nextPhase =
    partial?.jobPhase ??
    mapInternalStageToWorkerPhase(ctx.phase === "idle" ? activeWorkerPhase : ctx.phase);

  if (canTransitionDrWorkerPhase(activeWorkerPhase, nextPhase)) {
    activeWorkerPhase = nextPhase;
  } else if (nextPhase === activeWorkerPhase) {
    // no-op
  } else if (nextPhase === "failed" || nextPhase === "cancelled" || nextPhase === "completed") {
    activeWorkerPhase = nextPhase;
  }

  const payload = {
    jobPhase: activeWorkerPhase,
    processedObjects: partial?.processedObjects ?? ctx.processedObjects,
    totalObjects: partial?.totalObjects ?? ctx.totalObjects,
    archivePointer: partial?.archivePointer ?? ctx.archivePointer,
    bytesExported: partial?.bytesExported,
    workerId: partial?.workerId,
    heartbeatAt: partial?.heartbeatAt ?? new Date(),
    jobElapsedMs: partial?.jobElapsedMs ?? elapsed,
    jobMemoryRss: partial?.jobMemoryRss ?? memory.rss,
    jobHeapUsed: partial?.jobHeapUsed ?? memory.heapUsed,
  };

  await connectDB();
  await BackupRecord.findByIdAndUpdate(recordId, payload);
};

export const transitionDrWorkerJobPhase = async (
  recordId: string,
  phase: DrWorkerJobPhase
): Promise<void> => {
  await persistDrWorkerProgress(recordId, { jobPhase: phase });
};
