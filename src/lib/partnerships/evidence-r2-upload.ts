import "server-only";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import {
  buildAchievementAttachmentR2Key,
  buildR2PublicObjectUrl,
  getR2BucketName,
  getR2Client,
  isR2Configured,
} from "@/lib/r2";

export const uploadEvidenceBufferToR2 = async (input: {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}): Promise<{ storageKey: string; key: string; url: string }> => {
  if (!isR2Configured()) {
    throw new Error("Attachment storage is not configured");
  }
  const key = buildAchievementAttachmentR2Key(input.fileName);
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: getR2BucketName(),
      Key: key,
      Body: input.buffer,
      ContentType: input.mimeType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
  const url = buildR2PublicObjectUrl(key);
  return { storageKey: url, key, url };
};
