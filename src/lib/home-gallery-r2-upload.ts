import "server-only";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import {
  buildHomeGalleryR2Key,
  buildR2PublicObjectUrl,
  getR2BucketName,
  getR2Client,
  isR2Configured,
} from "@/lib/r2";

/** Same production R2 infrastructure as achievement attachments (src/lib/r2.ts) — no second client/bucket. */
export const uploadGalleryImageBufferToR2 = async (input: {
  albumKey: string;
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}): Promise<{ key: string; url: string }> => {
  if (!isR2Configured()) {
    throw new Error("Gallery image storage is not configured");
  }
  const key = buildHomeGalleryR2Key(input.albumKey, input.fileName);
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: getR2BucketName(),
      Key: key,
      Body: input.buffer,
      ContentType: input.mimeType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
  return { key, url: buildR2PublicObjectUrl(key) };
};

export const deleteGalleryImageFromR2 = async (key: string): Promise<void> => {
  if (!key) return;
  await getR2Client().send(
    new DeleteObjectCommand({ Bucket: getR2BucketName(), Key: key })
  );
};
