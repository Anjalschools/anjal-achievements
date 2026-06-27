import { once } from "events";
import { PassThrough, type Readable } from "stream";
import { DR_EXPORT_WATCHDOG_STALL_MS } from "@/lib/disaster-recovery/dr-async-timeout";

const DOWNLOAD_IDLE_INTERVAL_MS = 5_000;

let cloudinaryDownloadIdCounter = 0;

export type CloudinaryDownloadDiagnostics = {
  downloadId: number;
  objectKey: string;
  storageKey: string;
  downloadUrl: string;
  pipelineId?: number | null;
};

type StallCase = "A" | "B" | "C" | "D" | "UNKNOWN";

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

const classifyStallError = (input: {
  bytesReceived: number;
  contentLength: number | null;
  bodyEnded: boolean;
  readerDone: boolean;
}): string => {
  if (input.bytesReceived === 0) {
    return "DOWNLOAD_NO_FIRST_BYTE";
  }
  if (
    input.contentLength !== null &&
    input.bytesReceived === input.contentLength &&
    !input.bodyEnded &&
    !input.readerDone
  ) {
    return "DOWNLOAD_EOF_MISSING";
  }
  return "DOWNLOAD_DATA_STALLED";
};

const toAbortError = (signal: AbortSignal, fallback: Error): Error => {
  if (signal.reason instanceof Error) {
    return signal.reason;
  }
  return fallback;
};

export const createRobustCloudinaryDownloadStream = async (input: {
  downloadUrl: string;
  objectKey: string;
  storageKey: string;
  signal: AbortSignal;
  pipelineId?: number | null;
  workerId?: string | null;
  attempt?: number;
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
    attempt: input.attempt ?? 1,
  });

  let response: Response;
  try {
    response = await fetchFn(input.downloadUrl, { signal: downloadAbort.signal });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (downloadAbort.signal.aborted || input.signal.aborted) {
      logCloudinaryDownload("DOWNLOAD_ABORT", diagnostics, {
        abortReason: message,
        abortSignalReason: downloadAbort.signal.reason ?? input.signal.reason ?? null,
        elapsed: Date.now() - startedAt,
        bytesReceived: 0,
        durationMs: Date.now() - startedAt,
      });
      throw new Error(`DOWNLOAD_ABORTED:${message}`);
    }
    throw error;
  }

  const contentLength = parseContentLength(response);
  const headersReceived = true;
  logCloudinaryDownload("DOWNLOAD_HEADERS", diagnostics, {
    status: response.status,
    statusText: response.statusText,
    "content-length": response.headers.get("content-length"),
    "content-type": response.headers.get("content-type"),
    etag: response.headers.get("etag"),
    "cache-control": response.headers.get("cache-control"),
    "accept-ranges": response.headers.get("accept-ranges"),
    connection: response.headers.get("connection"),
    "transfer-encoding": response.headers.get("transfer-encoding"),
    redirected: response.redirected,
    url: response.url,
    contentLength,
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

  const webBody = response.body;
  const reader = webBody.getReader();
  const output = new PassThrough();

  let bytesReceived = 0;
  let chunkCount = 0;
  let lastChunkSize = 0;
  let lastChunkTimestamp: string | null = null;
  let firstByteAt: number | null = null;
  let lastByteAt: number | null = null;
  let previousChunkAt: number | null = null;
  let firstByteReceived = false;
  let bodyEnded = false;
  let readerDone = false;
  let failed = false;
  let readerCreated = true;
  let readerPending = false;
  let readerClosed = false;
  let readerCancelled = false;
  let readerReleased = false;
  let readerReadCallCount = 0;
  let readerReadResolvedCount = 0;
  let readerReadRejectedCount = 0;
  let readerCancelRequested = false;
  let readerCancelCompleted = false;
  let lastReaderReadStartedAt: number | null = null;
  let lastReaderReadResolvedAt: number | null = null;
  let outputWriteCount = 0;
  let lastWriteTimestamp: number | null = null;
  let lastWriteBytes = 0;
  let outputNeedDrain = false;
  let outputEnded = false;
  let outputFinished = false;
  let outputTerminalized = false;
  let sharedFailureError: Error | null = null;
  let lastLifecycleEvent = "reader-created";
  let stallTimer: ReturnType<typeof setTimeout> | undefined;
  let idleTimer: ReturnType<typeof setInterval> | undefined;
  let progressLogCounter = 0;
  let rejectPendingRead: ((error: Error) => void) | undefined;
  let terminateInFlight: Promise<void> | undefined;

  const setLifecycle = (event: string): void => {
    lastLifecycleEvent = event;
  };

  const clearStallTimer = (): void => {
    if (stallTimer) {
      clearTimeout(stallTimer);
      stallTimer = undefined;
    }
  };

  const clearIdleTimer = (): void => {
    if (idleTimer) {
      clearInterval(idleTimer);
      idleTimer = undefined;
    }
  };

  const clearTimers = (): void => {
    clearStallTimer();
    clearIdleTimer();
  };

  const timeSinceLastChunk = (): number | null => {
    if (lastByteAt === null) return null;
    return Date.now() - lastByteAt;
  };

  const timeSinceLastRead = (): number | null => {
    if (lastReaderReadStartedAt === null) return null;
    const anchor = lastReaderReadResolvedAt ?? Date.now();
    return anchor - lastReaderReadStartedAt;
  };

  const readLifecycleBase = () => ({
    chunkIndex: chunkCount,
    elapsedMs: Date.now() - startedAt,
    readerPending,
    readerClosed,
    readerReleased,
  });

  const classifyStallCase = (): StallCase => {
    if (readerReleased) {
      return "D";
    }
    if (readerClosed && !readerPending) {
      return "C";
    }
    if (!readerPending && outputNeedDrain) {
      return "B";
    }
    if (
      readerPending &&
      readerReadCallCount > readerReadResolvedCount &&
      !readerClosed
    ) {
      return "A";
    }
    return "UNKNOWN";
  };

  const buildForensicSnapshot = () => ({
    downloadId,
    bytesReceived,
    chunkCount,
    firstByteAt,
    lastByteAt,
    timeSinceLastChunk: timeSinceLastChunk(),
    responseBodyUsed: (response as Response & { bodyUsed?: boolean }).bodyUsed ?? null,
    responseBodyLocked: webBody.locked,
    readerCreated,
    readerPending,
    readerClosed,
    readerCancelled,
    readerReleased,
    readerDone,
    readerReadCallCount,
    readerReadResolvedCount,
    readerReadRejectedCount,
    readerCancelRequested,
    readerCancelCompleted,
    lastReaderReadStartedAt,
    lastReaderReadResolvedAt,
    timeSinceLastRead: timeSinceLastRead(),
    outputWriteCount,
    lastWriteTimestamp,
    lastWriteBytes,
    outputNeedDrain,
    outputDestroyed: output.destroyed,
    outputEnded,
    outputFinished,
    outputClosed: (output as PassThrough & { closed?: boolean }).closed ?? false,
    outputReadableEnded: output.readableEnded,
    outputWritableFinished: output.writableFinished,
    outputTerminalized,
    abortSignalAborted: downloadAbort.signal.aborted || input.signal.aborted,
    abortReason:
      downloadAbort.signal.reason ??
      input.signal.reason ??
      (downloadAbort.signal.aborted || input.signal.aborted ? "aborted" : null),
    contentLength,
    receivedLength: bytesReceived,
    headersReceived,
    firstByteReceived,
    lastChunkReceived: lastByteAt !== null,
    lastChunkTimestamp,
    lastChunkSize,
    lastLifecycleEvent,
    durationMs: Date.now() - startedAt,
  });

  const logTimeoutForensics = (trigger: string): void => {
    const stallCase = classifyStallCase();
    logCloudinaryDownload("DOWNLOAD_TIMEOUT_FORENSICS", diagnostics, {
      trigger,
      stallCase,
      ...buildForensicSnapshot(),
    });
  };

  const rejectReadWaiters = (error: Error): void => {
    rejectPendingRead?.(error);
    rejectPendingRead = undefined;
  };

  const waitForReadAbort = (): Promise<never> =>
    new Promise((_, reject) => {
      if (downloadAbort.signal.aborted) {
        reject(
          sharedFailureError ??
            toAbortError(downloadAbort.signal, new Error("DOWNLOAD_ABORTED"))
        );
        return;
      }
      rejectPendingRead = reject;
    });

  const endOutput = (): void => {
    if (outputTerminalized) return;
    outputTerminalized = true;
    outputEnded = true;
    setLifecycle("output-end");
    logCloudinaryDownload("DOWNLOAD_OUTPUT_END", diagnostics, {
      ...buildForensicSnapshot(),
    });
    output.end();
  };

  const destroyOutput = (error: Error): void => {
    if (outputTerminalized) return;
    outputTerminalized = true;
    setLifecycle("output-destroy");
    logCloudinaryDownload("DOWNLOAD_OUTPUT_DESTROY", diagnostics, {
      message: error.message,
      ...buildForensicSnapshot(),
    });
    logCloudinaryDownload("DOWNLOAD_DESTROY", diagnostics, {
      reason: error.message,
      message: error.message,
      ...buildForensicSnapshot(),
    });
    output.destroy(error);
  };

  const releaseReaderLock = (): void => {
    if (readerReleased || readerClosed) return;
    try {
      reader.releaseLock();
      readerReleased = true;
      setLifecycle("reader-released");
      logCloudinaryDownload("DOWNLOAD_READER_RELEASE", diagnostics, {
        readerCancelled,
        readerClosed,
        readerDone,
        readerPending,
      });
    } catch (releaseError) {
      logCloudinaryDownload("DOWNLOAD_READER_RELEASE", diagnostics, {
        readerCancelled,
        readerClosed,
        readerDone,
        readerPending,
        releaseError:
          releaseError instanceof Error ? releaseError.message : String(releaseError),
      });
    }
  };

  const runCleanup = (): void => {
    clearTimers();
    releaseReaderLock();
    if (sharedFailureError) {
      rejectReadWaiters(sharedFailureError);
    }
    logCloudinaryDownload("DOWNLOAD_CLEANUP_COMPLETE", diagnostics, {
      ...buildForensicSnapshot(),
    });
  };

  const terminateDownload = async (error: Error, fromStall = false): Promise<void> => {
    if (failed) return;
    if (terminateInFlight) {
      await terminateInFlight;
      return;
    }

    terminateInFlight = (async () => {
      failed = true;
      sharedFailureError = error;
      clearTimers();

      const isStallFamily =
        error.message === "DOWNLOAD_NO_FIRST_BYTE" ||
        error.message === "DOWNLOAD_DATA_STALLED" ||
        error.message === "DOWNLOAD_EOF_MISSING";

      const stallCase = fromStall ? classifyStallCase() : null;
      const shouldCancelReader =
        fromStall &&
        stallCase === "A" &&
        readerPending &&
        !readerReleased &&
        !readerCancelled &&
        !readerClosed;

      if (isStallFamily) {
        logTimeoutForensics(error.message);
        logCloudinaryDownload("DOWNLOAD_STALLED", diagnostics, {
          code: error.message,
          stallCase,
          shouldCancelReader,
          contentLength,
          bytesReceived,
          durationMs: Date.now() - startedAt,
          lastChunkTimestamp,
          lastChunkSize,
          abortReason: "no-data-progress",
        });
      } else if (
        error.message === "DOWNLOAD_INCOMPLETE" ||
        error.message === "DOWNLOAD_BODY_TRUNCATED"
      ) {
        logCloudinaryDownload("DOWNLOAD_INCOMPLETE", diagnostics, {
          code: error.message,
          contentLength,
          bytesReceived,
          durationMs: Date.now() - startedAt,
          lastChunkTimestamp,
          lastChunkSize,
        });
      }

      if (shouldCancelReader) {
        readerCancelRequested = true;
        logCloudinaryDownload("DOWNLOAD_READER_CANCEL_BEGIN", diagnostics, {
          message: error.message,
          stallCase,
          ...buildForensicSnapshot(),
        });

        try {
          await reader.cancel(error);
          readerCancelled = true;
          readerCancelCompleted = true;
          readerClosed = true;
          setLifecycle("reader-cancelled");
          logCloudinaryDownload("DOWNLOAD_READER_CANCEL_END", diagnostics, {
            message: error.message,
            readerPending,
            stallCase,
          });
        } catch (cancelError) {
          logCloudinaryDownload("DOWNLOAD_READER_CANCEL_ERROR", diagnostics, {
            message: error.message,
            stallCase,
            cancelError:
              cancelError instanceof Error ? cancelError.message : String(cancelError),
            readerPending,
          });
        }

        rejectReadWaiters(error);

        logCloudinaryDownload("DOWNLOAD_ABORT_BEGIN", diagnostics, {
          message: error.message,
          abortSignalAborted: downloadAbort.signal.aborted,
          stallCase,
        });

        if (!downloadAbort.signal.aborted) {
          downloadAbort.abort(error);
        }

        logCloudinaryDownload("DOWNLOAD_ABORT_END", diagnostics, {
          message: error.message,
          abortSignalReason: downloadAbort.signal.reason ?? null,
          elapsed: Date.now() - startedAt,
          bytesReceived,
          stallCase,
        });
      }

      logCloudinaryDownload("DOWNLOAD_ABORT", diagnostics, {
        abortReason: error.message,
        abortSignalReason: downloadAbort.signal.reason ?? input.signal.reason ?? null,
        elapsed: Date.now() - startedAt,
        contentLength,
        bytesReceived,
        durationMs: Date.now() - startedAt,
        lastChunkTimestamp,
        stallCase,
        readerCancelApplied: shouldCancelReader,
      });

      destroyOutput(error);
    })();

    await terminateInFlight;
  };

  const resetStallTimer = (): void => {
    clearStallTimer();
    stallTimer = setTimeout(() => {
      if (!bodyEnded && !failed) {
        const code = classifyStallError({
          bytesReceived,
          contentLength,
          bodyEnded,
          readerDone,
        });
        void terminateDownload(new Error(code), true);
      }
    }, DR_EXPORT_WATCHDOG_STALL_MS);
  };

  const recordChunk = (chunk: Buffer): void => {
    const now = Date.now();
    const elapsed = now - startedAt;
    const sinceLastChunk = previousChunkAt === null ? null : now - previousChunkAt;
    chunkCount += 1;
    lastChunkSize = chunk.byteLength;
    lastChunkTimestamp = new Date(now).toISOString();
    bytesReceived += chunk.byteLength;
    progressLogCounter += 1;

    if (!firstByteReceived) {
      firstByteReceived = true;
      firstByteAt = now;
      logCloudinaryDownload("FIRST_BYTE", diagnostics, {
        timeSinceDownloadBegin: now - startedAt,
        chunkSize: chunk.byteLength,
        bytesReceived,
        contentLength,
      });
    }

    lastByteAt = now;
    previousChunkAt = now;
    resetStallTimer();

    const averageRate = elapsed > 0 ? bytesReceived / elapsed : 0;
    const instantRate =
      sinceLastChunk !== null && sinceLastChunk > 0 ? chunk.byteLength / sinceLastChunk : null;

    logCloudinaryDownload("LAST_BYTE", diagnostics, {
      lastChunkTimestamp,
      lastChunkSize,
      chunkIndex: chunkCount,
      bytesReceived,
      contentLength,
    });

    if (progressLogCounter === 1 || progressLogCounter % 50 === 0) {
      logCloudinaryDownload("DOWNLOAD_PROGRESS", diagnostics, {
        bytesReceived,
        contentLength,
        chunkIndex: chunkCount,
        timeSinceLastChunk: sinceLastChunk,
        averageRate,
        instantRate,
        durationMs: elapsed,
        lastChunkTimestamp,
      });
    }
  };

  const pushChunk = async (chunk: Buffer): Promise<void> => {
    if (failed) return;

    logCloudinaryDownload("DOWNLOAD_STREAM_STATE", diagnostics, {
      phase: "before-push",
      chunkSize: chunk.byteLength,
      bytesReceived,
      outputDestroyed: output.destroyed,
      outputReadableEnded: output.readableEnded,
      outputWritableFinished: output.writableFinished,
    });

    logCloudinaryDownload("DOWNLOAD_OUTPUT_WRITE_BEGIN", diagnostics, {
      chunkSize: chunk.byteLength,
      outputWriteCount: outputWriteCount + 1,
      ...readLifecycleBase(),
    });

    const canContinue = output.write(chunk);
    outputWriteCount += 1;
    lastWriteTimestamp = Date.now();
    lastWriteBytes = chunk.byteLength;
    outputNeedDrain = !canContinue;
    recordChunk(chunk);

    logCloudinaryDownload("DOWNLOAD_OUTPUT_WRITE_END", diagnostics, {
      chunkSize: chunk.byteLength,
      outputWriteCount,
      pushReturnedFalse: !canContinue,
      outputNeedDrain,
      ...readLifecycleBase(),
    });

    logCloudinaryDownload("DOWNLOAD_STREAM_STATE", diagnostics, {
      phase: "after-push",
      chunkSize: chunk.byteLength,
      pushReturnedFalse: !canContinue,
      bytesReceived,
    });

    if (!canContinue && !failed) {
      logCloudinaryDownload("DOWNLOAD_OUTPUT_BACKPRESSURE", diagnostics, {
        bytesReceived,
        outputNeedDrain,
        ...readLifecycleBase(),
      });
      logCloudinaryDownload("DOWNLOAD_STREAM_STATE", diagnostics, {
        phase: "push-backpressure",
        bytesReceived,
      });
      await once(output, "drain");
      outputNeedDrain = false;
      logCloudinaryDownload("DOWNLOAD_OUTPUT_DRAIN", diagnostics, {
        bytesReceived,
        ...readLifecycleBase(),
      });
      logCloudinaryDownload("DOWNLOAD_STREAM_STATE", diagnostics, {
        phase: "drain",
        bytesReceived,
      });
    }
  };

  const readWithAbort = async (): Promise<ReadableStreamReadResult<Uint8Array>> => {
    return Promise.race([reader.read(), waitForReadAbort()]);
  };

  const logIdleState = (): void => {
    if (failed || bodyEnded) return;
    logCloudinaryDownload("DOWNLOAD_IDLE", diagnostics, {
      bytesReceived,
      elapsed: Date.now() - startedAt,
      timeSinceLastChunk: timeSinceLastChunk(),
      readerPending,
      bodyLocked: webBody.locked,
      bodyUsed: (response as Response & { bodyUsed?: boolean }).bodyUsed ?? null,
    });
  };

  logCloudinaryDownload("DOWNLOAD_WEB_STREAM_BRIDGE", diagnostics, {
    webBodyLocked: webBody.locked,
    readerActive: readerCreated,
    nodeStreamFlowing: null,
    bridge: "instrumented-reader-pump",
  });

  output.on("close", () => {
    outputFinished = true;
    setLifecycle("output-close");
    logCloudinaryDownload("DOWNLOAD_CLOSE", diagnostics, {
      ...buildForensicSnapshot(),
    });
  });

  resetStallTimer();
  idleTimer = setInterval(logIdleState, DOWNLOAD_IDLE_INTERVAL_MS);

  const pumpBody = async (): Promise<void> => {
    try {
      while (!failed) {
        logCloudinaryDownload("DOWNLOAD_READER_STATE", diagnostics, {
          phase: "before-read",
          readerPending,
          readerDone,
          bytesReceived,
        });

        readerReadCallCount += 1;
        readerPending = true;
        lastReaderReadStartedAt = Date.now();
        setLifecycle("reader-read-begin");

        logCloudinaryDownload("DOWNLOAD_READER_READ_BEGIN", diagnostics, {
          readerReadCallCount,
          ...readLifecycleBase(),
        });

        const readStart = Date.now();
        let readResult: ReadableStreamReadResult<Uint8Array>;
        try {
          readResult = await readWithAbort();
        } catch (readError) {
          readerReadRejectedCount += 1;
          readerPending = false;
          const error =
            readError instanceof Error ? readError : new Error(String(readError));
          setLifecycle("reader-read-rejected");
          logCloudinaryDownload("DOWNLOAD_READER_READ_REJECTED", diagnostics, {
            readerReadCallCount,
            readerReadRejectedCount,
            duration: Date.now() - readStart,
            message: error.message,
            ...readLifecycleBase(),
          });
          logCloudinaryDownload("DOWNLOAD_READER_STATE", diagnostics, {
            phase: "read-rejected",
            duration: Date.now() - readStart,
            readerPending,
            rejected: true,
            message: error.message,
          });
          if (failed) return;
          await terminateDownload(sharedFailureError ?? error);
          return;
        }

        readerReadResolvedCount += 1;
        readerPending = false;
        lastReaderReadResolvedAt = Date.now();
        setLifecycle("reader-read-resolved");

        const { done, value } = readResult;
        const valueLength = value?.byteLength ?? 0;

        logCloudinaryDownload("DOWNLOAD_READER_READ_RESOLVED", diagnostics, {
          readerReadCallCount,
          readerReadResolvedCount,
          duration: Date.now() - readStart,
          done,
          valueLength,
          ...readLifecycleBase(),
        });

        logCloudinaryDownload("DOWNLOAD_READER_STATE", diagnostics, {
          phase: "after-read",
          duration: Date.now() - readStart,
          readerPending,
          resolved: true,
          done,
          valueLength,
        });

        if (failed) return;

        if (done) {
          readerDone = true;
          break;
        }

        if (value && valueLength > 0) {
          await pushChunk(Buffer.from(value));
        }
      }

      if (failed) return;

      clearTimers();

      logCloudinaryDownload("DOWNLOAD_BODY_END", diagnostics, {
        bytesReceived,
        contentLength,
        totalChunks: chunkCount,
        lastChunkTimestamp,
        duration: Date.now() - startedAt,
      });

      logCloudinaryDownload("DOWNLOAD_BYTES_RECEIVED", diagnostics, {
        bytesReceived,
        contentLength,
        durationMs: Date.now() - startedAt,
        lastChunkTimestamp,
      });

      if (contentLength !== null && bytesReceived < contentLength) {
        await terminateDownload(new Error("DOWNLOAD_INCOMPLETE"));
        return;
      }

      bodyEnded = true;

      logCloudinaryDownload("DOWNLOAD_COMPLETE", diagnostics, {
        bytesReceived,
        contentLength,
        durationMs: Date.now() - startedAt,
        lastChunkTimestamp,
        totalChunks: chunkCount,
      });

      endOutput();
    } catch (error) {
      if (failed) return;
      const failure = error instanceof Error ? error : new Error(String(error));
      await terminateDownload(failure);
    } finally {
      runCleanup();
    }
  };

  void pumpBody();

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

type ReadableStreamReadResult<T> = {
  done: boolean;
  value?: T;
};
