import { Readable } from "stream";

import type { BackupStorageProviderId } from "@/lib/backup/backup-constants";
import {
  logBackupDownloadAborted,
  logBackupDownloadCompleted,
  logBackupDownloadProgress,
  logBackupDownloadStreamClosed,
  logBackupDownloadStreamError,
  type BackupDownloadDiagnosticContext,
} from "@/lib/backup/backup-download-diagnostics";
import { trackV2Stream } from "@/lib/disaster-recovery-v2/diagnostics/v2-stream-registry";

const DOWNLOAD_PROGRESS_INTERVAL_BYTES = 50 * 1024 * 1024;

const closeNodeReadable = (stream: Readable): void => {
  if (stream.destroyed) return;
  stream.destroy();
};

const attachDownloadProgressMonitor = (
  stream: Readable,
  context: BackupDownloadDiagnosticContext,
  totalBytes?: number
): void => {
  let nextMilestone = DOWNLOAD_PROGRESS_INTERVAL_BYTES;

  const readBytesSent = (): number => {
    if ("bytesRead" in stream && typeof stream.bytesRead === "number") {
      return stream.bytesRead;
    }
    return 0;
  };

  const maybeLogProgress = (final = false): void => {
    const currentBytes = readBytesSent();
    while (currentBytes >= nextMilestone && (totalBytes === undefined || nextMilestone <= totalBytes)) {
      logBackupDownloadProgress(context, {
        bytesSent: nextMilestone,
        totalBytes,
      });
      nextMilestone += DOWNLOAD_PROGRESS_INTERVAL_BYTES;
    }

    if (final) {
      logBackupDownloadProgress(context, {
        bytesSent: currentBytes,
        totalBytes,
        final: true,
      });
    }
  };

  const pollHandle = setInterval(() => {
    maybeLogProgress();
  }, 5_000);

  const stopPolling = (final = false): void => {
    clearInterval(pollHandle);
    maybeLogProgress(final);
  };

  stream.once("end", () => stopPolling(true));
  stream.once("close", () => stopPolling(true));
  stream.once("error", () => stopPolling(true));
};

export const createMonitoredBackupDownloadNodeStream = (input: {
  stream: Readable;
  context: BackupDownloadDiagnosticContext;
  label: string;
  totalBytes?: number;
}): Readable => {
  const tracked = trackV2Stream(input.stream, {
    kind: "read",
    label: input.label,
  });

  attachDownloadProgressMonitor(tracked, input.context, input.totalBytes);

  tracked.once("error", (error) => {
    logBackupDownloadStreamError(input.context, error, {
      bytesSent: "bytesRead" in tracked ? tracked.bytesRead : undefined,
    });
  });

  tracked.once("close", () => {
    logBackupDownloadStreamClosed(input.context, {
      bytesSent: "bytesRead" in tracked ? tracked.bytesRead : undefined,
    });
  });

  tracked.once("end", () => {
    logBackupDownloadCompleted(input.context, {
      bytesSent: "bytesRead" in tracked ? tracked.bytesRead : undefined,
    });
  });

  return tracked;
};

export const pipeBackupNodeReadableToWebStream = (input: {
  stream: Readable;
  context: BackupDownloadDiagnosticContext;
  abortSignal?: AbortSignal;
}): ReadableStream<Uint8Array> => {
  const handleAbort = (): void => {
    logBackupDownloadAborted(input.context, {
      bytesSent: "bytesRead" in input.stream ? input.stream.bytesRead : undefined,
    });
    closeNodeReadable(input.stream);
  };

  if (input.abortSignal) {
    if (input.abortSignal.aborted) {
      handleAbort();
    } else {
      input.abortSignal.addEventListener("abort", handleAbort, { once: true });
    }
  }

  return Readable.toWeb(input.stream) as ReadableStream<Uint8Array>;
};

export const createBackupDownloadDiagnosticContext = (input: {
  recordId: string;
  storageKey?: string;
  provider: BackupStorageProviderId;
}): BackupDownloadDiagnosticContext => ({
  recordId: input.recordId,
  storageKey: input.storageKey,
  provider: input.provider,
  startedAt: Date.now(),
});
