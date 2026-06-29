import "server-only";

import { GetObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";

import type { AchievementAttachmentObject } from "@/lib/achievement-attachments";
import { getR2BucketName, getR2Client, isR2Configured } from "@/lib/r2";

export type PortfolioEvidenceStreamResult = {
  stream: Readable;
  contentType: string;
  contentLength?: number;
  fileName: string;
};

const isReadableBody = (body: unknown): body is Readable =>
  Boolean(body) && typeof (body as Readable).pipe === "function";

const openR2AttachmentStream = async (
  key: string
): Promise<{ stream: Readable; contentLength?: number }> => {
  if (!isR2Configured()) throw new Error("R2_NOT_CONFIGURED");
  const response = await getR2Client().send(
    new GetObjectCommand({
      Bucket: getR2BucketName(),
      Key: key.replace(/^\/+/, ""),
    })
  );
  if (!isReadableBody(response.Body)) throw new Error("R2_OBJECT_EMPTY");
  return { stream: response.Body, contentLength: response.ContentLength };
};

const openRemoteUrlStream = async (
  url: string
): Promise<{ stream: Readable; contentLength?: number; contentType?: string }> => {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok || !response.body) {
    throw new Error("EVIDENCE_FETCH_FAILED");
  }
  const stream = Readable.fromWeb(response.body as import("stream/web").ReadableStream);
  const contentLengthHeader = response.headers.get("content-length");
  const contentLength =
    contentLengthHeader && /^\d+$/.test(contentLengthHeader)
      ? Number(contentLengthHeader)
      : undefined;
  const contentType = response.headers.get("content-type") || undefined;
  return { stream, contentLength, contentType };
};

export const openPortfolioEvidenceStream = async (
  attachment: AchievementAttachmentObject
): Promise<PortfolioEvidenceStreamResult> => {
  const fileName = attachment.name || "evidence";
  const contentType = attachment.mimeType || "application/octet-stream";

  if (attachment.key?.trim()) {
    const opened = await openR2AttachmentStream(attachment.key.trim());
    return {
      stream: opened.stream,
      contentType,
      contentLength: opened.contentLength ?? attachment.size,
      fileName,
    };
  }

  const url = attachment.url?.trim();
  if (!url || !/^https?:\/\//i.test(url)) {
    throw new Error("EVIDENCE_SOURCE_UNAVAILABLE");
  }

  const opened = await openRemoteUrlStream(url);
  return {
    stream: opened.stream,
    contentType: opened.contentType || contentType,
    contentLength: opened.contentLength ?? attachment.size,
    fileName,
  };
};
