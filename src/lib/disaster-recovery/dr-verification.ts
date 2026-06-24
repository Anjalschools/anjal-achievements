import type { Readable } from "stream";
import { getDrJobContext } from "@/lib/disaster-recovery/dr-job-context";
import { readProcessMemorySnapshot } from "@/lib/disaster-recovery/dr-memory-metrics";

export type DrMilestone =
  | "OBJECT_EXPORT_COMPLETED"
  | "ZIP_FINALIZE_STARTED"
  | "ZIP_FINALIZE_COMPLETED"
  | "UPLOAD_STARTED"
  | "UPLOAD_COMPLETED"
  | "R2_UPLOAD_COMPLETED"
  | "BACKUP_RECORD_CREATED"
  | "BACKUP_RECORD_SAVED"
  | "BACKUP_STATUS_COMPLETED"
  | "BACKUP_JOB_COMPLETED"
  | "HTTP_RESPONSE_READY"
  | "HTTP_RESPONSE_SENT";

export type DrPromiseStatus = "pending" | "resolved" | "rejected" | "timeout";

type DrPromiseEntry = {
  name: string;
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
  status: DrPromiseStatus;
};

type DrStreamEntry = {
  id: string;
  type: string;
  objectKey: string;
  stage: string;
  createdAt: number;
  stack: string;
  closed: boolean;
};

export type DrFinalReportFlags = {
  objectsProcessed: number;
  objectsFailed: number;
  bytesExported: number;
  zipFinalized: boolean;
  uploadCompleted: boolean;
  backupSaved: boolean;
  responseSent: boolean;
};

type DrVerificationSession = {
  active: boolean;
  recordId?: string;
  jobStartedAt: number;
  milestones: Set<DrMilestone>;
  lastMilestone?: DrMilestone;
  promises: Map<string, DrPromiseEntry>;
  streams: Map<string, DrStreamEntry>;
  streamSeq: number;
  peakRss: number;
  peakHeap: number;
  report: DrFinalReportFlags;
};

const createEmptySession = (): DrVerificationSession => ({
  active: false,
  jobStartedAt: 0,
  milestones: new Set(),
  promises: new Map(),
  streams: new Map(),
  streamSeq: 0,
  peakRss: 0,
  peakHeap: 0,
  report: {
    objectsProcessed: 0,
    objectsFailed: 0,
    bytesExported: 0,
    zipFinalized: false,
    uploadCompleted: false,
    backupSaved: false,
    responseSent: false,
  },
});

let session: DrVerificationSession = createEmptySession();

const captureMemoryPeaks = (): ReturnType<typeof readProcessMemorySnapshot> => {
  const snapshot = readProcessMemorySnapshot();
  session.peakRss = Math.max(session.peakRss, snapshot.rss);
  session.peakHeap = Math.max(session.peakHeap, snapshot.heapUsed);
  return snapshot;
};

const buildMilestoneMeta = (extra: Record<string, unknown> = {}): Record<string, unknown> => {
  const ctx = getDrJobContext();
  const memory = captureMemoryPeaks();
  const elapsedMs = session.jobStartedAt > 0 ? Date.now() - session.jobStartedAt : 0;
  return {
    recordId: session.recordId ?? ctx.recordId,
    processedObjects: ctx.processedObjects,
    totalObjects: ctx.totalObjects,
    archivePointer: ctx.archivePointer,
    elapsedMs,
    rss: memory.rss,
    heapUsed: memory.heapUsed,
    ...extra,
  };
};

export const isDrVerificationActive = (): boolean => session.active;

export const initDrVerification = (recordId?: string): void => {
  session = createEmptySession();
  session.active = true;
  session.recordId = recordId;
  session.jobStartedAt = Date.now();
  captureMemoryPeaks();
};

export const resetDrVerification = (): void => {
  session = createEmptySession();
};

export const updateDrVerificationReport = (partial: Partial<DrFinalReportFlags>): void => {
  session.report = { ...session.report, ...partial };
};

export const logDrMilestone = (milestone: DrMilestone, extra?: Record<string, unknown>): void => {
  session.milestones.add(milestone);
  session.lastMilestone = milestone;
  console.info(`[DR] ${milestone}`, buildMilestoneMeta(extra));
};

export const logDrException = (phase: string, error: unknown): void => {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  console.error("[DR] EXCEPTION", {
    phase,
    lastMilestone: session.lastMilestone ?? "NONE",
    lastReachedStage: getDrJobContext().phase,
    message,
    stack,
    ...buildMilestoneMeta(),
  });
};

export const trackDrPromise = <T>(name: string, promise: Promise<T>): Promise<T> => {
  if (!session.active) return promise;

  const startedAt = Date.now();
  const entry: DrPromiseEntry = { name, startedAt, status: "pending" };
  session.promises.set(name, entry);

  const finalize = (status: DrPromiseStatus, error?: unknown): void => {
    const current = session.promises.get(name);
    if (!current || current.status !== "pending") return;
    current.status = status;
    current.endedAt = Date.now();
    current.durationMs = current.endedAt - current.startedAt;
    if (error instanceof Error) {
      session.promises.set(name, { ...current });
    }
  };

  return promise.then(
    (value) => {
      finalize("resolved");
      return value;
    },
    (error) => {
      finalize("rejected", error);
      throw error;
    }
  );
};

export const markDrPromiseTimeout = (name: string): void => {
  if (!session.active) return;
  const entry = session.promises.get(name);
  if (!entry) return;
  entry.status = "timeout";
  entry.endedAt = Date.now();
  entry.durationMs = entry.endedAt - entry.startedAt;
};

export const registerDrTrackedStream = (
  stream: Readable,
  context: { objectKey: string; stage: string }
): string => {
  if (!session.active) return "";
  session.streamSeq += 1;
  const id = `stream-${session.streamSeq}`;
  const entry: DrStreamEntry = {
    id,
    type: stream.constructor?.name || "Readable",
    objectKey: context.objectKey,
    stage: context.stage,
    createdAt: Date.now(),
    stack: new Error().stack || "unknown",
    closed: false,
  };
  session.streams.set(id, entry);

  const markClosed = (): void => {
    const current = session.streams.get(id);
    if (!current) return;
    current.closed = true;
  };

  stream.once("close", markClosed);
  stream.once("end", markClosed);
  stream.once("error", markClosed);

  return id;
};

export const getPendingDrPromises = (): DrPromiseEntry[] =>
  Array.from(session.promises.values()).filter((entry) => entry.status === "pending");

export const getOpenDrStreams = (): DrStreamEntry[] =>
  Array.from(session.streams.values()).filter((entry) => !entry.closed);

export const logPendingDrPromises = (): void => {
  const pending = getPendingDrPromises();
  if (pending.length === 0) return;
  console.warn("[DR] Pending async operations:", {
    count: pending.length,
    operations: pending.map((entry) => ({
      name: entry.name,
      startedAt: entry.startedAt,
      elapsedMs: Date.now() - entry.startedAt,
      status: entry.status,
    })),
    ...buildMilestoneMeta(),
  });
};

export const logOpenDrStreams = (): void => {
  const open = getOpenDrStreams();
  console.info("[DR] Open Streams:", {
    count: open.length,
    streams: open.map((entry) => ({
      id: entry.id,
      type: entry.type,
      objectKey: entry.objectKey,
      stage: entry.stage,
      ageMs: Date.now() - entry.createdAt,
      stack: entry.stack,
    })),
    ...buildMilestoneMeta(),
  });
};

export type ArchiveVerifyState = {
  archivePointer: number;
  archiveAborted?: boolean;
  outputReadableEnded: boolean;
  outputDestroyed: boolean;
  outputWritableFinished: boolean;
};

export const verifyArchiveLifecycle = async (
  input: {
    getArchiveState: () => { pointer: number; aborted?: boolean };
    output: NodeJS.ReadWriteStream;
    timeoutMs?: number;
  }
): Promise<ArchiveVerifyState> => {
  const timeoutMs = input.timeoutMs ?? 30_000;
  const deadline = Date.now() + timeoutMs;
  let lastState: ArchiveVerifyState | null = null;

  while (Date.now() < deadline) {
    const archiveState = input.getArchiveState();
    const output = input.output as NodeJS.ReadWriteStream & {
      readableEnded?: boolean;
      destroyed?: boolean;
      writableFinished?: boolean;
    };
    lastState = {
      archivePointer: archiveState.pointer,
      archiveAborted: archiveState.aborted,
      outputReadableEnded: Boolean(output.readableEnded),
      outputDestroyed: Boolean(output.destroyed),
      outputWritableFinished: Boolean(output.writableFinished),
    };

    if (
      lastState.outputReadableEnded &&
      lastState.outputWritableFinished &&
      !lastState.outputDestroyed
    ) {
      return lastState;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  console.error("[DR] ARCHIVE_VERIFY_FAILED", {
    reason: "archive/output not settled within timeout",
    state: lastState,
    ...buildMilestoneMeta(),
  });
  return lastState ?? {
    archivePointer: 0,
    outputReadableEnded: false,
    outputDestroyed: false,
    outputWritableFinished: false,
  };
};

export const printDrFinalReport = (): void => {
  if (!session.active && session.jobStartedAt === 0) return;

  logPendingDrPromises();
  logOpenDrStreams();

  const elapsedMs = session.jobStartedAt > 0 ? Date.now() - session.jobStartedAt : 0;
  const pendingCount = getPendingDrPromises().length;
  const openStreamCount = getOpenDrStreams().length;
  const { report } = session;

  const lines = [
    "========== DR FINAL REPORT ==========",
    `Objects Processed: ${report.objectsProcessed}`,
    `Objects Failed: ${report.objectsFailed}`,
    `Bytes Exported: ${report.bytesExported}`,
    `ZIP Finalized: ${report.zipFinalized ? "yes" : "no"}`,
    `Upload Completed: ${report.uploadCompleted ? "yes" : "no"}`,
    `Backup Saved: ${report.backupSaved ? "yes" : "no"}`,
    `Response Sent: ${report.responseSent ? "yes" : "no"}`,
    `Open Streams: ${openStreamCount}`,
    `Pending Promises: ${pendingCount}`,
    `Elapsed Time: ${elapsedMs}ms`,
    `Peak RSS: ${session.peakRss}`,
    `Peak Heap: ${session.peakHeap}`,
    `Last Milestone: ${session.lastMilestone ?? "NONE"}`,
    `Milestones: ${Array.from(session.milestones).join(", ") || "NONE"}`,
    "=====================================",
  ];

  console.info(lines.join("\n"));

  if (!session.milestones.has("BACKUP_JOB_COMPLETED")) {
    console.warn("[DR] BACKUP_JOB_NOT_COMPLETED", {
      lastMilestone: session.lastMilestone ?? "NONE",
      ...buildMilestoneMeta(),
    });
  }
};

export const getDrMilestones = (): DrMilestone[] => Array.from(session.milestones);

export const logDrHttpMilestone = (
  milestone: "HTTP_RESPONSE_READY" | "HTTP_RESPONSE_SENT",
  recordId: string,
  extra?: Record<string, unknown>
): void => {
  const memory = captureMemoryPeaks();
  if (session.active) {
    session.milestones.add(milestone);
    if (milestone === "HTTP_RESPONSE_SENT") {
      session.report.responseSent = true;
    }
  }
  console.info(`[DR] ${milestone}`, {
    recordId,
    processedObjects: getDrJobContext().processedObjects,
    totalObjects: getDrJobContext().totalObjects,
    archivePointer: getDrJobContext().archivePointer,
    elapsedMs: session.jobStartedAt > 0 ? Date.now() - session.jobStartedAt : 0,
    rss: memory.rss,
    heapUsed: memory.heapUsed,
    ...extra,
  });
};
