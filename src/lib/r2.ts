import "server-only";
import { randomBytes } from "crypto";
import { extname } from "path";
import { S3Client, PutObjectCommand, type S3ClientConfig } from "@aws-sdk/client-s3";

/** `R2_ACCOUNT_ID` may exist in env for ops/docs; this module uses `R2_ENDPOINT` as the full S3 API base URL. */

const REQUIRED_ENV = [
  "R2_ENDPOINT",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_BASE_URL",
] as const;

export const isR2Configured = (): boolean =>
  REQUIRED_ENV.every((key) => Boolean(process.env[key]?.trim()));

export const assertR2Env = (): void => {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `[R2] Missing environment variables: ${missing.join(", ")}. Configure them for attachment uploads.`
    );
  }
};

let client: S3Client | null = null;

export const getR2Client = (): S3Client => {
  assertR2Env();
  if (!client) {
    const cfg: S3ClientConfig = {
      region: "auto",
      endpoint: process.env.R2_ENDPOINT!.trim(),
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!.trim(),
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!.trim(),
      },
      forcePathStyle: true,
    };
    client = new S3Client(cfg);
  }
  return client;
};

const safeFileExtension = (originalName: string): string => {
  const raw = extname(originalName || "").slice(0, 24).toLowerCase();
  if (!raw || raw === ".") return ".bin";
  if (!/^\.[a-z0-9._-]+$/i.test(raw)) return ".bin";
  return raw;
};

/** Object key: achievements/attachments/{yyyy}/{mm}/{random}{ext} */
export const buildAchievementAttachmentR2Key = (originalFilename: string): string => {
  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const id = randomBytes(16).toString("hex");
  const ext = safeFileExtension(originalFilename);
  return `achievements/attachments/${yyyy}/${mm}/${id}${ext}`;
};

/** Public URL for a stored object key (R2 public bucket / custom domain). */
export const buildR2PublicObjectUrl = (key: string): string => {
  assertR2Env();
  const base = process.env.R2_PUBLIC_BASE_URL!.trim().replace(/\/+$/, "");
  const k = key.trim().replace(/^\/+/, "");
  return `${base}/${k}`;
};

export const getR2BucketName = (): string => process.env.R2_BUCKET_NAME!.trim();
