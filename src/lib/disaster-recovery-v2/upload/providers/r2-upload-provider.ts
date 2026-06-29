import { PutObjectCommand } from "@aws-sdk/client-s3";
import { createReadStream, type ReadStream } from "fs";

import type { BackupContext } from "@/lib/disaster-recovery-v2/types/backup-context";
import type { BackupUploadProvider } from "@/lib/disaster-recovery-v2/upload/upload-provider";
import type { UploadArtifact, UploadResult } from "@/lib/disaster-recovery-v2/upload/upload-artifact-types";
import { UploadProviderError } from "@/lib/disaster-recovery-v2/upload/upload-retry-policy";
import {
  attachV2UploadProgressMonitor,
  logMemorySnapshot,
} from "@/lib/disaster-recovery-v2/diagnostics/v2-memory-diagnostics";
import { trackV2Stream } from "@/lib/disaster-recovery-v2/diagnostics/v2-stream-registry";
import { createOrGetDrV2R2UploadS3Client } from "@/lib/disaster-recovery-v2/upload/providers/r2-upload-s3-client";
import { attachR2UploadStreamDiagnostics } from "@/lib/disaster-recovery-v2/upload/providers/r2-upload-stream-diagnostics";
import { logDrV2 } from "@/lib/disaster-recovery-v2/utils/logging";

export const R2_UPLOAD_PROVIDER_ID = "r2" as const;

/** 64 KiB — keeps fs read buffers small while respecting backpressure. */
const UPLOAD_READ_STREAM_HIGH_WATER_MARK = 64 * 1024;

export type R2PutObjectHandler = (input: {
  artifact: UploadArtifact;
  objectKey: string;
  context: BackupContext;
}) => Promise<UploadResult>;

export type R2BackupUploadProviderOptions = {
  resolveObjectKey?: (context: BackupContext, artifact: UploadArtifact) => string;
  putObject?: R2PutObjectHandler;
};

const defaultResolveObjectKey = (context: BackupContext, artifact: UploadArtifact): string =>
  `dr-v2/backups/${context.config.jobId}/${artifact.filename}`;

const mapPutObjectError = (error: unknown): UploadProviderError => {
  if (error instanceof UploadProviderError) return error;

  const message = error instanceof Error ? error.message : String(error);
  const httpStatus =
    typeof error === "object" &&
    error !== null &&
    "$metadata" in error &&
    typeof (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode ===
      "number"
      ? (error as { $metadata: { httpStatusCode: number } }).$metadata.httpStatusCode
      : undefined;

  const permanent =
    httpStatus === 401 ||
    httpStatus === 403 ||
    message.includes("AccessDenied") ||
    message.includes("InvalidAccessKeyId") ||
    message.includes("Missing S3 credentials");

  return new UploadProviderError(message, { httpStatus, permanent });
};

const closeUploadReadStream = (readStream: ReadStream): void => {
  if (readStream.destroyed || readStream.readableEnded) return;
  readStream.destroy();
};

const createUploadReadStream = (filePath: string): ReadStream =>
  createReadStream(filePath, { highWaterMark: UPLOAD_READ_STREAM_HIGH_WATER_MARK });

export const createR2BackupUploadProvider = (
  options: R2BackupUploadProviderOptions = {}
): BackupUploadProvider => ({
  id: R2_UPLOAD_PROVIDER_ID,
  upload: async (artifact, context) => {
    const objectKey = (options.resolveObjectKey ?? defaultResolveObjectKey)(context, artifact);

    if (options.putObject) {
      return options.putObject({ artifact, objectKey, context });
    }

    const { client, settings } = createOrGetDrV2R2UploadS3Client();
    const readStream = trackV2Stream(createUploadReadStream(artifact.path), {
      kind: "read",
      label: `upload-source:${artifact.path}`,
    });

    logDrV2("UPLOAD_STREAM_CREATED", {
      jobId: context.config.jobId,
      objectKey,
      bytes: artifact.size,
    });
    logMemorySnapshot("UPLOAD_STREAM_CREATED", {
      jobId: context.config.jobId,
      objectKey,
      totalBytes: artifact.size,
    });

    readStream.once("open", () => {
      logDrV2("UPLOAD_STREAM_OPEN", {
        jobId: context.config.jobId,
        objectKey,
      });
      logMemorySnapshot("UPLOAD_STREAM_OPEN", {
        jobId: context.config.jobId,
        objectKey,
      });
    });

    readStream.once("close", () => {
      logDrV2("UPLOAD_STREAM_CLOSE", {
        jobId: context.config.jobId,
        objectKey,
      });
      logMemorySnapshot("UPLOAD_STREAM_CLOSE", {
        jobId: context.config.jobId,
        objectKey,
      });
    });

    readStream.once("end", () => {
      logDrV2("UPLOAD_STREAM_FINISH", {
        jobId: context.config.jobId,
        objectKey,
      });
      logMemorySnapshot("UPLOAD_STREAM_FINISH", {
        jobId: context.config.jobId,
        objectKey,
      });
    });

    readStream.once("error", (error) => {
      logDrV2("UPLOAD_STREAM_ERROR", {
        jobId: context.config.jobId,
        objectKey,
        message: error instanceof Error ? error.message : String(error),
      });
    });

    attachR2UploadStreamDiagnostics(readStream, {
      jobId: context.config.jobId,
      objectKey,
      totalBytes: artifact.size,
    });

    attachV2UploadProgressMonitor(readStream, {
      totalBytes: artifact.size,
      jobId: context.config.jobId,
    });

    try {
      const command = new PutObjectCommand({
        Bucket: settings.bucket,
        Key: objectKey,
        Body: readStream,
        ContentLength: artifact.size,
        ContentType: "application/zip",
      });

      logDrV2("UPLOAD_REQUEST_CREATED", {
        jobId: context.config.jobId,
        objectKey,
        contentLength: artifact.size,
        requestChecksumCalculation: "WHEN_REQUIRED",
      });
      logMemorySnapshot("UPLOAD_REQUEST_CREATED", {
        jobId: context.config.jobId,
        objectKey,
        totalBytes: artifact.size,
      });

      const response = await client.send(command);

      logDrV2("UPLOAD_REQUEST_FINISHED", {
        jobId: context.config.jobId,
        objectKey,
        etag: response.ETag,
      });
      logMemorySnapshot("UPLOAD_REQUEST_FINISHED", {
        jobId: context.config.jobId,
        objectKey,
        uploadedBytes: artifact.size,
      });

      logDrV2("UPLOAD_RESPONSE_RECEIVED", {
        jobId: context.config.jobId,
        objectKey,
        etag: response.ETag,
      });
      logMemorySnapshot("UPLOAD_RESPONSE_RECEIVED", {
        jobId: context.config.jobId,
        objectKey,
        uploadedBytes: artifact.size,
      });

      logDrV2("UPLOAD_SUCCESS", {
        jobId: context.config.jobId,
        objectKey,
        uploadedBytes: artifact.size,
      });
      logMemorySnapshot("UPLOAD_SUCCESS", {
        jobId: context.config.jobId,
        objectKey,
        uploadedBytes: artifact.size,
      });

      return {
        provider: R2_UPLOAD_PROVIDER_ID,
        objectKey,
        etag: response.ETag?.replace(/"/g, ""),
        uploadedBytes: artifact.size,
        completedAt: new Date(),
      };
    } catch (error) {
      logDrV2("UPLOAD_FAILED", {
        jobId: context.config.jobId,
        objectKey,
        message: error instanceof Error ? error.message : String(error),
      });
      logMemorySnapshot("UPLOAD_FAILED", {
        jobId: context.config.jobId,
        objectKey,
      });
      throw mapPutObjectError(error);
    } finally {
      closeUploadReadStream(readStream);
    }
  },
});
