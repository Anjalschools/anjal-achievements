import { getV2ActiveStreamCounts } from "@/lib/disaster-recovery-v2/diagnostics/v2-stream-registry";
import { logDrV2 } from "@/lib/disaster-recovery-v2/utils/logging";

export type V2MemorySnapshot = {
  rss: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
  uptime: number;
  pid: number;
  timestamp: string;
};

export type V2MemoryPeakSnapshot = {
  peakRSS: number;
  peakHeap: number;
  peakExternal: number;
  peakArrayBuffers: number;
};

export type V2MemoryDiagnosticsPublicSnapshot = {
  jobId?: string;
  currentStage?: string;
  lastCompletedStage?: string;
  jobStartedAt?: number;
  peaks: V2MemoryPeakSnapshot;
  stageDurationsMs: Record<string, number>;
};

type StageTiming = {
  startedAt: number;
  completedAt?: number;
};

const emptyPeaks = (): V2MemoryPeakSnapshot => ({
  peakRSS: 0,
  peakHeap: 0,
  peakExternal: 0,
  peakArrayBuffers: 0,
});

let session: {
  jobId: string;
  jobStartedAt: number;
  currentStage?: string;
  lastCompletedStage?: string;
  peaks: V2MemoryPeakSnapshot;
  stageTimings: Map<string, StageTiming>;
  packageBuildDurationMs?: number;
  uploadDurationMs?: number;
} | null = null;

const buildMemorySnapshot = (): V2MemorySnapshot => {
  const usage = process.memoryUsage();
  return {
    rss: usage.rss,
    heapUsed: usage.heapUsed,
    heapTotal: usage.heapTotal,
    external: usage.external,
    arrayBuffers: usage.arrayBuffers,
    uptime: process.uptime(),
    pid: process.pid,
    timestamp: new Date().toISOString(),
  };
};

const updatePeaks = (snapshot: V2MemorySnapshot): void => {
  if (!session) return;
  session.peaks.peakRSS = Math.max(session.peaks.peakRSS, snapshot.rss);
  session.peaks.peakHeap = Math.max(session.peaks.peakHeap, snapshot.heapUsed);
  session.peaks.peakExternal = Math.max(session.peaks.peakExternal, snapshot.external);
  session.peaks.peakArrayBuffers = Math.max(session.peaks.peakArrayBuffers, snapshot.arrayBuffers);
};

export const beginV2MemoryDiagnosticsSession = (jobId: string): void => {
  session = {
    jobId,
    jobStartedAt: Date.now(),
    peaks: emptyPeaks(),
    stageTimings: new Map(),
  };
};

export const endV2MemoryDiagnosticsSession = (): void => {
  session = null;
};

export const getV2MemoryDiagnosticsSnapshot = (): V2MemoryDiagnosticsPublicSnapshot => ({
  jobId: session?.jobId,
  currentStage: session?.currentStage,
  lastCompletedStage: session?.lastCompletedStage,
  jobStartedAt: session?.jobStartedAt,
  peaks: session?.peaks ?? emptyPeaks(),
  stageDurationsMs: session
    ? Object.fromEntries(
        [...session.stageTimings.entries()].map(([stage, timing]) => [
          stage,
          (timing.completedAt ?? Date.now()) - timing.startedAt,
        ])
      )
    : {},
});

export const setV2MemoryDiagnosticsCurrentStage = (stage: string): void => {
  if (!session) return;
  session.currentStage = stage;
  if (!session.stageTimings.has(stage)) {
    session.stageTimings.set(stage, { startedAt: Date.now() });
  }
};

export const markV2MemoryDiagnosticsStageComplete = (stage: string): void => {
  if (!session) return;
  const timing = session.stageTimings.get(stage) ?? { startedAt: Date.now() };
  timing.completedAt = Date.now();
  session.stageTimings.set(stage, timing);
  session.lastCompletedStage = stage;
};

export const recordV2PackageBuildDurationMs = (durationMs: number): void => {
  if (!session) return;
  session.packageBuildDurationMs = durationMs;
};

export const recordV2UploadDurationMs = (durationMs: number): void => {
  if (!session) return;
  session.uploadDurationMs = durationMs;
};

export const logMemorySnapshot = (
  stage: string,
  extra: Record<string, unknown> = {}
): V2MemorySnapshot => {
  const snapshot = buildMemorySnapshot();
  updatePeaks(snapshot);
  const streamCounts = getV2ActiveStreamCounts();

  logDrV2("MEMORY_SNAPSHOT", {
    stage,
    jobId: session?.jobId,
    currentStage: session?.currentStage,
    ...snapshot,
    activeReadStreams: streamCounts.readStreams,
    activeWriteStreams: streamCounts.writeStreams,
    activePassThroughStreams: streamCounts.passThroughStreams,
    activeStreamsTotal: streamCounts.total,
    ...extra,
  });

  return snapshot;
};

export const logV2StreamRegistryCounts = (stage: string, extra: Record<string, unknown> = {}): void => {
  const streamCounts = getV2ActiveStreamCounts();
  logDrV2("STREAM_REGISTRY_COUNTS", {
    stage,
    jobId: session?.jobId,
    ...streamCounts,
    ...extra,
  });
};

export const logMemoryAtFailure = (
  failedStage: string,
  error: unknown,
  extra: Record<string, unknown> = {}
): void => {
  const snapshot = buildMemorySnapshot();
  updatePeaks(snapshot);
  const message = error instanceof Error ? error.message : String(error);

  logDrV2("MEMORY_AT_FAILURE", {
    failedStage,
    lastCompletedStage: session?.lastCompletedStage,
    jobId: session?.jobId,
    error: message,
    rss: snapshot.rss,
    heapUsed: snapshot.heapUsed,
    heapTotal: snapshot.heapTotal,
    external: snapshot.external,
    arrayBuffers: snapshot.arrayBuffers,
    peakRSS: session?.peaks.peakRSS,
    peakHeap: session?.peaks.peakHeap,
    peakExternal: session?.peaks.peakExternal,
    peakArrayBuffers: session?.peaks.peakArrayBuffers,
    ...extra,
  });
};

const resolveLargestStage = (): { stage: string; durationMs: number } | undefined => {
  if (!session) return undefined;
  let largest: { stage: string; durationMs: number } | undefined;
  for (const [stage, timing] of session.stageTimings.entries()) {
    const durationMs = (timing.completedAt ?? Date.now()) - timing.startedAt;
    if (!largest || durationMs > largest.durationMs) {
      largest = { stage, durationMs };
    }
  }
  return largest;
};

export const logV2JobDiagnosticSummary = (input: {
  success: boolean;
  jobId: string;
}): void => {
  const snapshot = buildMemorySnapshot();
  updatePeaks(snapshot);
  const totalRuntimeMs = session ? Date.now() - session.jobStartedAt : 0;
  const largestStage = resolveLargestStage();

  logDrV2("JOB_DIAGNOSTIC_SUMMARY", {
    success: input.success,
    jobId: input.jobId,
    totalRuntimeMs,
    peakRSS: session?.peaks.peakRSS ?? snapshot.rss,
    peakHeap: session?.peaks.peakHeap ?? snapshot.heapUsed,
    peakExternal: session?.peaks.peakExternal ?? snapshot.external,
    peakArrayBuffers: session?.peaks.peakArrayBuffers ?? snapshot.arrayBuffers,
    largestStage: largestStage?.stage,
    largestStageDurationMs: largestStage?.durationMs,
    packageBuildDurationMs: session?.packageBuildDurationMs,
    uploadDurationMs: session?.uploadDurationMs,
    lastCompletedStage: session?.lastCompletedStage,
    currentStage: session?.currentStage,
    finalRss: snapshot.rss,
    finalHeapUsed: snapshot.heapUsed,
    finalExternal: snapshot.external,
    finalArrayBuffers: snapshot.arrayBuffers,
  });

  logMemorySnapshot(input.success ? "JOB_COMPLETE" : "JOB_FAILED");
};

export const attachV2UploadProgressMonitor = (
  stream: NodeJS.ReadableStream,
  input: { totalBytes: number; jobId?: string }
): NodeJS.ReadableStream => {
  const progressIntervalBytes = 50 * 1024 * 1024;
  let nextMilestone = progressIntervalBytes;

  const readUploadedBytes = (): number => {
    if ("bytesRead" in stream && typeof stream.bytesRead === "number") {
      return stream.bytesRead;
    }
    return 0;
  };

  const maybeLogProgress = (uploadedBytes: number, final = false): void => {
    while (uploadedBytes >= nextMilestone && nextMilestone <= input.totalBytes) {
      logMemorySnapshot("UPLOAD_PROGRESS", {
        uploadedBytes: nextMilestone,
        totalBytes: input.totalBytes,
        jobId: input.jobId ?? session?.jobId,
      });
      nextMilestone += progressIntervalBytes;
    }

    if (final) {
      logMemorySnapshot("UPLOAD_PROGRESS", {
        uploadedBytes,
        totalBytes: input.totalBytes,
        jobId: input.jobId ?? session?.jobId,
        final: true,
      });
    }
  };

  const pollHandle = setInterval(() => {
    maybeLogProgress(readUploadedBytes());
  }, 5_000);

  const stopPolling = (): void => {
    clearInterval(pollHandle);
    maybeLogProgress(readUploadedBytes(), true);
  };

  stream.once("end", stopPolling);
  stream.once("close", stopPolling);
  stream.once("error", stopPolling);

  return stream;
};
