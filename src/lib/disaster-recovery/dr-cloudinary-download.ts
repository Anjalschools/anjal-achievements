import { PassThrough, type Readable } from "stream";
import { DR_EXPORT_WATCHDOG_STALL_MS } from "@/lib/disaster-recovery/dr-async-timeout";
import { webBodyToNodeStream } from "@/lib/disaster-recovery/dr-stream-utils";

let cloudinaryDownloadIdCounter = 0;

export type CloudinaryDownloadDiagnostics = {
  downloadId: number;
  objectKey: string;
  storageKey: string;
  downloadUrl: string;
  pipelineId?: number | null;
};

const logCloudinaryDownload = (
  label: string,
  context: CloudinaryDownloadDiagnostics,
  extra: Record<string, unknown> = {}
): void => {
  console.info(`[DR] ${label}`, {
    downloadId: context.downloadId,
    objectKey: context.objectKey,
    storageKey: context.storageKey,
    downloadUrl: context.downloadUrl,
    pipelineId: context.pipelineId ?? null,
    timestamp: new Date().toISOString(),
    ...extra,
  });
};

const linkAbortSignal = (
  downloadAbort: AbortController,
  parentSignal: AbortSignal
): void => {
  if (parentSignal.aborted) {
    downloadAbort.abort(parentSignal.reason);
    return;
  }
  parentSignal.addEventListener(
    "abort",
    () => {
      if (!downloadAbort.signal.aborted) {
        downloadAbort.abort(parentSignal.reason ?? "parent-abort");
      }
    },
    { once: true }
  );
};

const parseContentLength = (response: Response): number | null => {
  const raw = response.headers.get("content-length");
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

export const createRobustCloudinaryDownloadStream = async (input: {
  downloadUrl: string;
  objectKey: string;
  storageKey: string;
  signal: AbortSignal;
  pipelineId?: number | null;
  workerId?: string | null;
  fetchImpl?: typeof fetch;
}): Promise<Readable> => {
  const downloadId = ++cloudinaryDownloadIdCounter;
  console.info("[DR] ROBUST_DOWNLOAD_STREAM_ACTIVE", {
    objectKey: input.objectKey,
    downloadId,
    downloadUrl: input.downloadUrl,
    workerId: input.workerId ?? null,
    pid: process.pid,
    timestamp: new Date().toISOString(),
  });
  const startedAt = Date.now();
  const diagnostics: CloudinaryDownloadDiagnostics = {
    downloadId,
    objectKey: input.objectKey,
    storageKey: input.storageKey,
    downloadUrl: input.downloadUrl,
    pipelineId: input.pipelineId ?? null,
  };
  const downloadAbort = new AbortController();
  linkAbortSignal(downloadAbort, input.signal);
  const fetchFn = input.fetchImpl ?? fetch;

  logCloudinaryDownload("DOWNLOAD_BEGIN", diagnostics, {
    durationMs: 0,
  });

  let response: Response;
  try {
    response = await fetchFn(input.downloadUrl, { signal: downloadAbort.signal });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (downloadAbort.signal.aborted || input.signal.aborted) {
      logCloudinaryDownload("DOWNLOAD_ABORT", diagnostics, {
        abortReason: message,
        durationMs: Date.now() - startedAt,
      });
      throw new Error(`DOWNLOAD_ABORTED:${message}`);
    }
    throw error;
  }

  const contentLength = parseContentLength(response);
  logCloudinaryDownload("DOWNLOAD_HEADERS", diagnostics, {
    status: response.status,
    ok: response.ok,
    redirected: response.redirected,
    url: response.url,
    contentLength,
    contentType: response.headers.get("content-type"),
    cacheControl: response.headers.get("cache-control"),
    server: response.headers.get("server"),
    cloudinaryError: response.headers.get("x-cld-error"),
    requestId: response.headers.get("x-request-id"),
    durationMs: Date.now() - startedAt,
  });

  if (!response.ok) {
    const responseBody = await response.text().catch(() => "<body unavailable>");
    console.error("[DR] CLOUDINARY_FETCH_FAILURE", {
      storageKey: input.storageKey,
      objectKey: input.objectKey,
      downloadUrl: input.downloadUrl,
      status: response.status,
      body: responseBody.substring(0, 2000),
    });
    throw new Error(`CLOUDINARY_DOWNLOAD_FAILED:${response.status}`);
  }

  if (!response.body) {
    logCloudinaryDownload("DOWNLOAD_INCOMPLETE", diagnostics, {
      bytesReceived: 0,
      contentLength,
      durationMs: Date.now() - startedAt,
      abortReason: "empty-body",
    });
    throw new Error("CLOUDINARY_BODY_EMPTY");
  }

  const source = webBodyToNodeStream(response.body);
  const output = new PassThrough();

  let bytesReceived = 0;
  let lastChunkSize = 0;
  let lastChunkTimestamp: string | null = null;
  let bodyEnded = false;
  let failed = false;
  let stallTimer: ReturnType<typeof setTimeout> | undefined;
  let progressLogCounter = 0;

  const clearStallTimer = (): void => {
    if (stallTimer) {
      clearTimeout(stallTimer);
      stallTimer = undefined;
    }
  };

  const failDownload = (code: string, abortReason: string): void => {
    if (failed) return;
    failed = true;
    clearStallTimer();

    const stallLabel =
      code === "DOWNLOAD_STREAM_STALLED"
        ? "DOWNLOAD_STALLED"
        : code === "DOWNLOAD_INCOMPLETE" || code === "DOWNLOAD_BODY_TRUNCATED"
          ? "DOWNLOAD_INCOMPLETE"
          : code === "DOWNLOAD_SOCKET_CLOSED"
            ? "DOWNLOAD_SOCKET_CLOSE"
            : null;

    if (stallLabel) {
      logCloudinaryDownload(stallLabel, diagnostics, {
        contentLength,
        bytesReceived,
        durationMs: Date.now() - startedAt,
        lastChunkTimestamp,
        lastChunkSize,
        abortReason,
      });
    }

    logCloudinaryDownload("DOWNLOAD_ABORT", diagnostics, {
      abortReason,
      contentLength,
      bytesReceived,
      durationMs: Date.now() - startedAt,
      lastChunkTimestamp,
    });

    if (!downloadAbort.signal.aborted) {
      try {
        downloadAbort.abort(abortReason);
      } catch {
        // Abort may already be in progress.
      }
    }

    const error = new Error(code);
    if (source.readable) {
      source.unpipe(output);
    }
    output.destroy(error);
  };

  const resetStallTimer = (): void => {
    clearStallTimer();
    stallTimer = setTimeout(() => {
      if (!bodyEnded && !failed) {
        failDownload("DOWNLOAD_STREAM_STALLED", "no-data-progress");
      }
    }, DR_EXPORT_WATCHDOG_STALL_MS);
  };

  const recordChunk = (chunk: Buffer): void => {
    lastChunkSize = chunk.byteLength;
    lastChunkTimestamp = new Date().toISOString();
    bytesReceived += chunk.byteLength;
    progressLogCounter += 1;
    resetStallTimer();

    logCloudinaryDownload("DOWNLOAD_LAST_CHUNK", diagnostics, {
      lastChunkSize,
      bytesReceived,
      contentLength,
      durationMs: Date.now() - startedAt,
      lastChunkTimestamp,
    });

    if (progressLogCounter === 1 || progressLogCounter % 50 === 0) {
      logCloudinaryDownload("DOWNLOAD_PROGRESS", diagnostics, {
        bytesReceived,
        contentLength,
        durationMs: Date.now() - startedAt,
        lastChunkTimestamp,
      });
    }
  };

  resetStallTimer();

  source.on("data", (chunk: Buffer | string) => {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    recordChunk(buffer);
  });

  source.on("end", () => {
    clearStallTimer();

    logCloudinaryDownload("DOWNLOAD_BODY_END", diagnostics, {
      bytesReceived,
      contentLength,
      durationMs: Date.now() - startedAt,
      lastChunkTimestamp,
    });

    logCloudinaryDownload("DOWNLOAD_BYTES_RECEIVED", diagnostics, {
      bytesReceived,
      contentLength,
      durationMs: Date.now() - startedAt,
      lastChunkTimestamp,
    });

    if (contentLength !== null && bytesReceived !== contentLength) {
      failDownload(
        "DOWNLOAD_INCOMPLETE",
        `expected=${contentLength},actual=${bytesReceived}`
      );
      return;
    }

    bodyEnded = true;

    logCloudinaryDownload("DOWNLOAD_COMPLETE", diagnostics, {
      bytesReceived,
      contentLength,
      durationMs: Date.now() - startedAt,
      lastChunkTimestamp,
    });
  });

  source.on("close", () => {
    clearStallTimer();
    if (failed || bodyEnded) return;

    if (bytesReceived === 0) {
      failDownload("DOWNLOAD_SOCKET_CLOSED", "premature-close-before-bytes");
      return;
    }

    if (contentLength !== null && bytesReceived < contentLength) {
      failDownload(
        "DOWNLOAD_BODY_TRUNCATED",
        `expected=${contentLength},actual=${bytesReceived}`
      );
    }
  });

  source.on("error", (error) => {
    clearStallTimer();
    if (failed) return;
    failed = true;
    logCloudinaryDownload("DOWNLOAD_ABORT", diagnostics, {
      abortReason: error instanceof Error ? error.message : String(error),
      contentLength,
      bytesReceived,
      durationMs: Date.now() - startedAt,
    });
    output.destroy(error);
  });

  source.pipe(output);

  console.info("[DR] ROBUST_DOWNLOAD_STREAM_RETURN", {
    objectKey: input.objectKey,
    downloadId,
    downloadUrl: input.downloadUrl,
    workerId: input.workerId ?? null,
    pid: process.pid,
    timestamp: new Date().toISOString(),
  });

  return output;
};
