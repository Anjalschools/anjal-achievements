import type { Readable } from "stream";
import { truncateDrErrorStack } from "@/lib/disaster-recovery/dr-diag-policy";

export type DrObjectStreamDiagContext = {
  provider: string;
  storageKey?: string;
  archivePath: string;
  objectId?: string;
  streamName?: string;
};

const formatDrStreamError = (
  error: unknown
): {
  message: string;
  stack?: string;
  name?: string;
  cause?: string;
} => {
  if (error instanceof Error) {
    const cause =
      error.cause instanceof Error
        ? error.cause.message
        : error.cause
          ? String(error.cause)
          : undefined;
    return {
      message: error.message,
      stack: truncateDrErrorStack(error),
      name: error.name,
      cause,
    };
  }
  return { message: String(error) };
};

export const logDrObjectStreamError = (
  context: DrObjectStreamDiagContext,
  error: unknown
): void => {
  console.error("[DR] OBJECT_STREAM_ERROR", {
    ...context,
    ...formatDrStreamError(error),
  });
};

export const logDrDownloadProviderFailed = (
  context: DrObjectStreamDiagContext,
  error: unknown
): void => {
  console.error("[DR] DOWNLOAD_PROVIDER_FAILED", {
    ...context,
    ...formatDrStreamError(error),
  });
};

export const logDrArchiveAppendFailed = (
  context: DrObjectStreamDiagContext,
  error: unknown
): void => {
  console.error("[DR] ARCHIVE_APPEND_FAILED", {
    ...context,
    ...formatDrStreamError(error),
  });
};

export const logDrPipelineStreamError = (
  context: DrObjectStreamDiagContext,
  error: unknown
): void => {
  console.error("[DR] PIPELINE_STREAM_ERROR", {
    ...context,
    ...formatDrStreamError(error),
  });
};

export const attachDrObjectStreamErrorLogging = (
  stream: Readable,
  context: DrObjectStreamDiagContext
): Readable => {
  stream.on("error", (error) => {
    logDrObjectStreamError(context, error);
  });
  return stream;
};

export const buildDrObjectStreamContext = (input: {
  entry: {
    id: string;
    provider: string;
    storageKey: string;
    archivePath: string;
  };
  streamName?: string;
}): DrObjectStreamDiagContext => ({
  provider: input.entry.provider,
  storageKey: input.entry.storageKey,
  archivePath: input.entry.archivePath,
  objectId: input.entry.id,
  streamName: input.streamName,
});
