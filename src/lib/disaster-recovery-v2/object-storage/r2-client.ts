import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getR2BucketName, getR2Client, isR2Configured } from "@/lib/r2";
import type { Readable } from "stream";

export const getConfiguredR2BucketName = (): string => getR2BucketName();

export const fetchR2ObjectStream = async (input: {
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

  return client.send(command, input.abortSignal ? { abortSignal: input.abortSignal } : undefined);
};

export const uploadR2ObjectStream = async (input: {
  key: string;
  body: Readable;
  contentType: string;
}): Promise<{ ETag?: string }> => {
  if (!isR2Configured()) {
    throw new Error("R2_NOT_CONFIGURED");
  }

  const client = getR2Client();
  const command = new PutObjectCommand({
    Bucket: getR2BucketName(),
    Key: input.key.replace(/^\/+/, ""),
    Body: input.body,
    ContentType: input.contentType,
  });

  return client.send(command);
};
