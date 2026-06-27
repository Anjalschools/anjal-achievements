import type { Readable } from "stream";
import { DrOperationTimeoutError } from "@/lib/disaster-recovery/dr-async-timeout";
import { HASHING_PIPELINE_TIMEOUT_CODE } from "@/lib/disaster-recovery/dr-cloudinary-export-policy";
import { recordMissingAsset } from "@/lib/disaster-recovery/dr-cloudinary-missing-asset-registry";
import { destroyDrStream } from "@/lib/disaster-recovery/dr-stream-lifecycle";
import type { DrArchiveStreamRegistry } from "@/lib/disaster-recovery/dr-stream-utils";
import type { StorageManifestEntry } from "@/lib/disaster-recovery/storage-manifest-types";

export const isCloudinaryHashingPipelineTimeout = (
  error: unknown,
  provider: string
): boolean => {
  if (provider !== "cloudinary") return false;
  if (error instanceof DrOperationTimeoutError && error.operation === "hashingPipeline") {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return message.startsWith("DR_TIMEOUT:hashingPipeline");
};

const parseCloudinaryPublicId = (storageKey: string): string => {
  if (storageKey.startsWith("cloudinary://")) {
    const [, ...rest] = storageKey.replace("cloudinary://", "").split("/");
    return rest.join("/") || storageKey;
  }
  return storageKey;
};

const resolveOriginalUrl = (storageKey: string): string =>
  /^https?:\/\//i.test(storageKey) ? storageKey : storageKey;

export const handleCloudinaryHashingPipelineTimeoutSkip = (input: {
  entry: StorageManifestEntry;
  error: unknown;
  stream: Readable;
  streamRegistry?: DrArchiveStreamRegistry;
}): StorageManifestEntry => {
  const errorMessage = input.error instanceof Error ? input.error.message : String(input.error);
  const now = new Date().toISOString();
  const objectKey = input.entry.archivePath;

  console.info("[DR] HASHING_PIPELINE_TIMEOUT_DETECTED", {
    objectKey,
    provider: input.entry.provider,
    error: errorMessage,
    timestamp: now,
  });

  console.info("[DR] HASHING_PIPELINE_TIMEOUT_CLEANUP_BEGIN", {
    objectKey,
    streamDestroyed: input.stream.destroyed,
    timestamp: now,
  });

  destroyDrStream(input.stream, input.error instanceof Error ? input.error : undefined);
  input.streamRegistry?.markProducerError(input.stream, errorMessage);
  input.streamRegistry?.markProducerCompleted(input.stream);

  console.info("[DR] HASHING_PIPELINE_TIMEOUT_CLEANUP_END", {
    objectKey,
    streamDestroyed: input.stream.destroyed,
    timestamp: now,
  });

  recordMissingAsset({
    objectKey,
    provider: "cloudinary",
    publicId: parseCloudinaryPublicId(input.entry.storageKey),
    originalUrl: resolveOriginalUrl(input.entry.storageKey),
    failureReason: "hashing_pipeline_timeout",
    errorCode: HASHING_PIPELINE_TIMEOUT_CODE,
    attempts: 1,
    bytesReceived: 0,
    contentLength: input.entry.fileSize ?? null,
    firstFailureAt: now,
    finalFailureAt: now,
    stage: "hashingPipeline",
  });

  console.info("[DR] HASHING_PIPELINE_TIMEOUT_SKIPPED", {
    objectKey,
    reason: HASHING_PIPELINE_TIMEOUT_CODE,
    timestamp: now,
  });

  return {
    ...input.entry,
    status: "missing",
    fileSize: 0,
    errorMessage: HASHING_PIPELINE_TIMEOUT_CODE,
  };
};
