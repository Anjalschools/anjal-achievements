import { PassThrough, type Readable } from "stream";
import { createRobustCloudinaryDownloadStream } from "@/lib/disaster-recovery/dr-cloudinary-download";
import {
  CLOUDINARY_DOWNLOAD_MAX_ATTEMPTS,
  classifyMissingAssetReason,
  isPermanentCloudinaryFailure,
  isTransientCloudinaryFailure,
  toCloudinaryMissingAssetError,
} from "@/lib/disaster-recovery/dr-cloudinary-export-policy";
import { recordMissingAsset } from "@/lib/disaster-recovery/dr-cloudinary-missing-asset-registry";

const logRetry = (label: string, extra: Record<string, unknown>): void => {
  console.info(`[DR] ${label}`, {
    timestamp: new Date().toISOString(),
    ...extra,
  });
};

const pipeAttemptStream = (
  source: Readable,
  output: PassThrough,
  onBytes: (count: number) => void
): Promise<void> =>
  new Promise((resolve, reject) => {
    const handleData = (chunk: Buffer | string): void => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      onBytes(buffer.byteLength);
      const canContinue = output.write(buffer);
      if (!canContinue) {
        source.pause();
        output.once("drain", () => source.resume());
      }
    };

    const cleanup = (): void => {
      source.off("data", handleData);
      source.off("end", handleEnd);
      source.off("error", handleError);
      source.off("close", handleClose);
    };

    const handleEnd = (): void => {
      cleanup();
      resolve();
    };

    const handleError = (error: Error): void => {
      cleanup();
      reject(error);
    };

    const handleClose = (): void => {
      cleanup();
      reject(new Error("DOWNLOAD_SOCKET_CLOSED"));
    };

    source.on("data", handleData);
    source.on("end", handleEnd);
    source.on("error", handleError);
    source.on("close", handleClose);
  });

const destroyAttemptStream = (stream: Readable | null): void => {
  if (!stream || stream.destroyed) return;
  stream.destroy();
};

export const createResilientCloudinaryDownloadStream = async (input: {
  downloadUrl: string;
  objectKey: string;
  storageKey: string;
  signal: AbortSignal;
  pipelineId?: number | null;
  workerId?: string | null;
  publicId: string;
  fetchImpl?: typeof fetch;
}): Promise<Readable> => {
  const output = new PassThrough();
  let bytesWritten = 0;
  let contentLength: number | null = null;

  const pumpWithRetries = async (): Promise<void> => {
    let firstFailureAt: string | null = null;
    let lastError: Error = new Error("CLOUDINARY_DOWNLOAD_FAILED");

    for (let attempt = 1; attempt <= CLOUDINARY_DOWNLOAD_MAX_ATTEMPTS; attempt += 1) {
      if (bytesWritten > 0) {
        break;
      }

      const attemptAbort = new AbortController();
      const linkAbort = (): void => {
        if (input.signal.aborted) {
          attemptAbort.abort(input.signal.reason);
          return;
        }
        input.signal.addEventListener(
          "abort",
          () => {
            if (!attemptAbort.signal.aborted) {
              attemptAbort.abort(input.signal.reason ?? "parent-abort");
            }
          },
          { once: true }
        );
      };
      linkAbort();

      let attemptStream: Readable | null = null;
      let attemptBytes = 0;

      try {
        if (attempt > 1) {
          logRetry("DOWNLOAD_RETRY_BEGIN", {
            objectKey: input.objectKey,
            attempt,
            maxAttempts: CLOUDINARY_DOWNLOAD_MAX_ATTEMPTS,
            reason: lastError.message,
            storageKey: input.storageKey,
            downloadUrl: input.downloadUrl,
          });
        }

        attemptStream = await createRobustCloudinaryDownloadStream({
          downloadUrl: input.downloadUrl,
          objectKey: input.objectKey,
          storageKey: input.storageKey,
          signal: attemptAbort.signal,
          pipelineId: input.pipelineId,
          workerId: input.workerId,
          fetchImpl: input.fetchImpl,
          attempt,
        });

        await pipeAttemptStream(attemptStream, output, (count) => {
          attemptBytes += count;
          bytesWritten += count;
        });

        if (attempt > 1) {
          logRetry("DOWNLOAD_RETRY_SUCCESS", {
            objectKey: input.objectKey,
            attempt,
            maxAttempts: CLOUDINARY_DOWNLOAD_MAX_ATTEMPTS,
            bytesWritten,
          });
        }

        output.end();
        return;
      } catch (error) {
        destroyAttemptStream(attemptStream);
        const failure = error instanceof Error ? error : new Error(String(error));
        lastError = failure;
        const failureAt = new Date().toISOString();
        if (!firstFailureAt) {
          firstFailureAt = failureAt;
        }

        const permanent = isPermanentCloudinaryFailure(failure);
        const transient = isTransientCloudinaryFailure(failure);
        const canRetry =
          !permanent &&
          transient &&
          attempt < CLOUDINARY_DOWNLOAD_MAX_ATTEMPTS &&
          attemptBytes === 0 &&
          bytesWritten === 0;

        if (canRetry) {
          logRetry("DOWNLOAD_RETRY_FAILED", {
            objectKey: input.objectKey,
            attempt,
            maxAttempts: CLOUDINARY_DOWNLOAD_MAX_ATTEMPTS,
            reason: failure.message,
            bytesWritten,
            attemptBytes,
          });
          continue;
        }

        const finalAttempts = permanent ? attempt : CLOUDINARY_DOWNLOAD_MAX_ATTEMPTS;
        if (!permanent && attempt >= CLOUDINARY_DOWNLOAD_MAX_ATTEMPTS) {
          logRetry("DOWNLOAD_RETRY_EXHAUSTED", {
            objectKey: input.objectKey,
            attempt,
            maxAttempts: CLOUDINARY_DOWNLOAD_MAX_ATTEMPTS,
            reason: failure.message,
            bytesWritten,
            attemptBytes,
          });
        }

        recordMissingAsset({
          objectKey: input.objectKey,
          provider: "cloudinary",
          publicId: input.publicId,
          originalUrl: input.downloadUrl,
          failureReason: classifyMissingAssetReason(failure),
          errorCode: failure.message,
          attempts: finalAttempts,
          bytesReceived: bytesWritten,
          contentLength,
          firstFailureAt: firstFailureAt ?? failureAt,
          finalFailureAt: failureAt,
        });

        output.destroy(toCloudinaryMissingAssetError(failure));
        return;
      }
    }
  };

  void pumpWithRetries().catch((error) => {
    if (!output.destroyed) {
      const failure = error instanceof Error ? error : new Error(String(error));
      output.destroy(toCloudinaryMissingAssetError(failure));
    }
  });

  return output;
};
