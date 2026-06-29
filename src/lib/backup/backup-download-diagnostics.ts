import type { BackupStorageProviderId } from "@/lib/backup/backup-constants";
import { getV2ActiveStreamCounts } from "@/lib/disaster-recovery-v2/diagnostics/v2-stream-registry";

export type BackupDownloadDiagnosticContext = {
  recordId: string;
  storageKey?: string;
  provider: BackupStorageProviderId;
  startedAt: number;
};

const readMemoryFields = (): {
  rss: number;
  heapUsed: number;
  external: number;
  arrayBuffers: number;
} => {
  const usage = process.memoryUsage();
  return {
    rss: usage.rss,
    heapUsed: usage.heapUsed,
    external: usage.external,
    arrayBuffers: usage.arrayBuffers,
  };
};

const logDownloadDiagnostic = (
  event: string,
  context: BackupDownloadDiagnosticContext,
  extra: Record<string, unknown> = {}
): void => {
  const streamCounts = getV2ActiveStreamCounts();
  const elapsedMs = Date.now() - context.startedAt;
  const memory = readMemoryFields();

  console.info(`[DR] ${event}`, {
    recordId: context.recordId,
    storageKey: context.storageKey,
    provider: context.provider,
    elapsedMs,
    activeStreams: streamCounts.total,
    activeReadStreams: streamCounts.readStreams,
    rss: memory.rss,
    heapUsed: memory.heapUsed,
    external: memory.external,
    arrayBuffers: memory.arrayBuffers,
    ...extra,
  });
};

export const logBackupDownloadStarted = (
  context: BackupDownloadDiagnosticContext,
  extra?: Record<string, unknown>
): void => {
  logDownloadDiagnostic("DOWNLOAD_REQUEST_STARTED", context, extra);
};

export const logBackupDownloadStreamCreated = (
  context: BackupDownloadDiagnosticContext,
  extra?: Record<string, unknown>
): void => {
  logDownloadDiagnostic("DOWNLOAD_STREAM_CREATED", context, extra);
};

export const logBackupDownloadHeadersSent = (
  context: BackupDownloadDiagnosticContext,
  extra?: Record<string, unknown>
): void => {
  logDownloadDiagnostic("DOWNLOAD_HEADERS_SENT", context, extra);
};

export const logBackupDownloadProgress = (
  context: BackupDownloadDiagnosticContext,
  extra: Record<string, unknown>
): void => {
  logDownloadDiagnostic("DOWNLOAD_PROGRESS", context, extra);
};

export const logBackupDownloadCompleted = (
  context: BackupDownloadDiagnosticContext,
  extra?: Record<string, unknown>
): void => {
  logDownloadDiagnostic("DOWNLOAD_COMPLETED", context, extra);
};

export const logBackupDownloadAborted = (
  context: BackupDownloadDiagnosticContext,
  extra?: Record<string, unknown>
): void => {
  logDownloadDiagnostic("DOWNLOAD_ABORTED", context, extra);
};

export const logBackupDownloadStreamError = (
  context: BackupDownloadDiagnosticContext,
  error: unknown,
  extra?: Record<string, unknown>
): void => {
  logDownloadDiagnostic("DOWNLOAD_STREAM_ERROR", context, {
    message: error instanceof Error ? error.message : String(error),
    ...extra,
  });
};

export const logBackupDownloadFailed = (
  context: BackupDownloadDiagnosticContext,
  error: unknown,
  extra?: Record<string, unknown>
): void => {
  logDownloadDiagnostic("DOWNLOAD_FAILED", context, {
    message: error instanceof Error ? error.message : String(error),
    ...extra,
  });
};

export const logBackupDownloadStreamClosed = (
  context: BackupDownloadDiagnosticContext,
  extra?: Record<string, unknown>
): void => {
  logDownloadDiagnostic("DOWNLOAD_STREAM_CLOSED", context, extra);
};
