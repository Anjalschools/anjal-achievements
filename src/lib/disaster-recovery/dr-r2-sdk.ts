import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import {
  sendAwsCommandWithDiagnostics,
  type AwsSendClient,
} from "@/lib/disaster-recovery/dr-aws-sdk-diagnostics";
import { getR2BucketName, getR2Client, isR2Configured } from "@/lib/r2";
import type { Readable } from "stream";

export const sendR2PutObject = async (input: {
  key: string;
  body: Buffer | Readable;
  contentType: string;
  uploadBody?: Readable;
}): Promise<{ ETag?: string }> => {
  if (!isR2Configured()) {
    throw new Error("R2_NOT_CONFIGURED");
  }

  const client = getR2Client();
  const bucket = getR2BucketName();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: input.key,
    Body: input.body,
    ContentType: input.contentType,
  });

  return sendAwsCommandWithDiagnostics<{ ETag?: string }>(
    client as AwsSendClient,
    command,
    {
      provider: "r2",
      uploadBody: input.uploadBody,
    }
  );
};

export const sendR2GetObject = async (input: {
  key: string;
  abortSignal?: AbortSignal;
}): Promise<{ Body?: unknown; ETag?: string }> => {
  if (!isR2Configured()) {
    throw new Error("R2_NOT_CONFIGURED");
  }

  const client = getR2Client();
  const command = new GetObjectCommand({
    Bucket: getR2BucketName(),
    Key: input.key.replace(/^\/+/, ""),
  });

  return sendAwsCommandWithDiagnostics<{ Body?: unknown; ETag?: string }>(
    client as AwsSendClient,
    command,
    {
      provider: "r2",
      abortSignal: input.abortSignal,
      sendOptions: input.abortSignal ? { abortSignal: input.abortSignal } : undefined,
    }
  );
};
