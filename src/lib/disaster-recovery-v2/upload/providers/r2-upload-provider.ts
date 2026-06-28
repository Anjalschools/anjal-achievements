import { PutObjectCommand } from "@aws-sdk/client-s3";
import { createReadStream } from "fs";

import { createOrGetR2S3Client } from "@/lib/storage/r2-config";
import type { BackupContext } from "@/lib/disaster-recovery-v2/types/backup-context";
import type { BackupUploadProvider } from "@/lib/disaster-recovery-v2/upload/upload-provider";
import type { UploadArtifact, UploadResult } from "@/lib/disaster-recovery-v2/upload/upload-artifact-types";
import { UploadProviderError } from "@/lib/disaster-recovery-v2/upload/upload-retry-policy";

export const R2_UPLOAD_PROVIDER_ID = "r2" as const;

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

export const createR2BackupUploadProvider = (
  options: R2BackupUploadProviderOptions = {}
): BackupUploadProvider => ({
  id: R2_UPLOAD_PROVIDER_ID,
  upload: async (artifact, context) => {
    const objectKey = (options.resolveObjectKey ?? defaultResolveObjectKey)(context, artifact);

    if (options.putObject) {
      return options.putObject({ artifact, objectKey, context });
    }

    try {
      const { client, settings } = createOrGetR2S3Client();
      const response = await client.send(
        new PutObjectCommand({
          Bucket: settings.bucket,
          Key: objectKey,
          Body: createReadStream(artifact.path),
          ContentLength: artifact.size,
          ContentType: "application/zip",
        })
      );

      return {
        provider: R2_UPLOAD_PROVIDER_ID,
        objectKey,
        etag: response.ETag?.replace(/"/g, ""),
        uploadedBytes: artifact.size,
        completedAt: new Date(),
      };
    } catch (error) {
      throw mapPutObjectError(error);
    }
  },
});
