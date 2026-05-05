/**
 * Helpers for migrating legacy achievement media (data URLs in Mongo)
 * to Cloudinary (images) and Cloudflare R2 (attachments / PDFs).
 * Used only by scripts — uses `storage/r2-config` (no `server-only` import).
 */

import { randomBytes } from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getCloudinary, isCloudinaryConfigured } from "../cloudinary";
import { inferNameFromUrl } from "../achievement-attachments";
import { buildR2PublicUrlFromResolved, createOrGetR2S3Client } from "../storage/r2-config";

const LEGACY_IMAGE_FOLDER = "achievements/images/legacy";

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

const DATA_URL_BASE64 = /^data:([^;]+);base64,([\s\S]+)$/i;

export type MigrationMode = "all" | "images" | "attachments";

export type CloudinaryLegacyImageResult = {
  secure_url: string;
  public_id: string;
  width: number;
  height: number;
};

const extForMime = (mime: string): string => {
  const m = mime.toLowerCase();
  if (m.includes("pdf")) return ".pdf";
  if (m.includes("png")) return ".png";
  if (m.includes("jpeg") || m.includes("jpg")) return ".jpg";
  if (m.includes("webp")) return ".webp";
  if (m.includes("gif")) return ".gif";
  if (m.includes("text/plain")) return ".txt";
  return ".bin";
};

/** R2 key: achievements/attachments/legacy/{yyyy}/{mm}/{id}{ext} */
export const buildLegacyAttachmentR2Key = (mimeType: string): string => {
  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const id = randomBytes(14).toString("hex");
  const ext = extForMime(mimeType);
  return `achievements/attachments/legacy/${yyyy}/${mm}/${id}${ext}`;
};

export const decodeDataUrl = (dataUrl: string): { buffer: Buffer; mimeType: string } | null => {
  const t = dataUrl.trim();
  const m = DATA_URL_BASE64.exec(t);
  if (!m?.[1] || !m[2]) return null;
  const mimeType = String(m[1]).trim().toLowerCase();
  const b64 = String(m[2]).replace(/\s/g, "");
  try {
    const buffer = Buffer.from(b64, "base64");
    if (!buffer.length) return null;
    return { buffer, mimeType };
  } catch {
    return null;
  }
};

/** Legacy image: embedded data URL only (idempotent with normal https URLs). */
export const isLegacyAchievementImage = (image: unknown): image is string => {
  if (typeof image !== "string") return false;
  const t = image.trim();
  return /^data:image\//i.test(t);
};

/** String or object whose url is a heavy data URL (image or pdf or other). */
export const isLegacyAttachmentItem = (item: unknown): boolean => {
  if (typeof item === "string") return item.trim().startsWith("data:");
  if (!item || typeof item !== "object") return false;
  const url = String((item as { url?: unknown }).url ?? "").trim();
  return url.startsWith("data:");
};

export const isAlreadyExternalImageUrl = (image: unknown): boolean => {
  if (typeof image !== "string") return false;
  const t = image.trim();
  if (!t || t.startsWith("data:")) return false;
  if (/^https?:\/\//i.test(t)) return true;
  if (t.startsWith("/")) return true;
  return false;
};

export const isAlreadyExternalAttachmentRef = (item: unknown): boolean => {
  if (typeof item === "string") {
    const t = item.trim();
    return Boolean(t) && !t.startsWith("data:");
  }
  if (!item || typeof item !== "object") return false;
  const url = String((item as { url?: unknown }).url ?? "").trim();
  return Boolean(url) && !url.startsWith("data:");
};

export async function uploadLegacyImageToCloudinary(
  buffer: Buffer,
  mimeType: string
): Promise<CloudinaryLegacyImageResult> {
  if (!isCloudinaryConfigured()) {
    throw new Error("[Cloudinary] Not configured");
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new Error(`Image too large (${buffer.length} bytes > ${MAX_IMAGE_BYTES})`);
  }
  const cloudinary = getCloudinary();
  const dataUri = `data:${mimeType};base64,${buffer.toString("base64")}`;
  const result = await cloudinary.uploader.upload(dataUri, {
    folder: LEGACY_IMAGE_FOLDER,
    resource_type: "image",
    use_filename: false,
    unique_filename: true,
  });
  return {
    secure_url: result.secure_url,
    public_id: result.public_id,
    width: result.width ?? 0,
    height: result.height ?? 0,
  };
}

export type R2LegacyUploadResult = {
  url: string;
  key: string;
  mimeType: string;
  size: number;
};

export async function uploadLegacyAttachmentToR2(
  buffer: Buffer,
  mimeType: string,
  suggestedName: string
): Promise<R2LegacyUploadResult> {
  if (buffer.length > MAX_ATTACHMENT_BYTES) {
    throw new Error(`Attachment too large (${buffer.length} bytes > ${MAX_ATTACHMENT_BYTES})`);
  }
  const key = buildLegacyAttachmentR2Key(mimeType);
  const { client, settings } = createOrGetR2S3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: settings.bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType || "application/octet-stream",
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
  const url = buildR2PublicUrlFromResolved(settings, key);
  return { url, key, mimeType: mimeType || "application/octet-stream", size: buffer.length };
}

export type MigratedAttachmentDescriptor = {
  url: string;
  key: string;
  name: string;
  fileName: string;
  mimeType: string;
  size: number;
  provider: "r2";
};

export function buildDescriptorFromR2(
  r: R2LegacyUploadResult,
  name: string,
  fileName: string
): MigratedAttachmentDescriptor {
  return {
    url: r.url,
    key: r.key,
    name,
    fileName,
    mimeType: r.mimeType,
    size: r.size,
    provider: "r2",
  };
}

/**
 * Migrate one attachment slot: data URL string or { url: data:... } → R2 descriptor.
 * Returns null if item does not need migration.
 */
export async function migrateOneAttachmentItem(
  item: unknown
): Promise<MigratedAttachmentDescriptor | null | "unchanged"> {
  if (isAlreadyExternalAttachmentRef(item)) return "unchanged";
  if (typeof item === "string") {
    const decoded = decodeDataUrl(item);
    if (!decoded) return null;
    const name = inferNameFromUrl(item);
    const safeName = name || `legacy-${randomBytes(4).toString("hex")}${extForMime(decoded.mimeType)}`;
    const uploaded = await uploadLegacyAttachmentToR2(decoded.buffer, decoded.mimeType, safeName);
    return buildDescriptorFromR2(uploaded, safeName, safeName);
  }
  if (item && typeof item === "object") {
    const o = item as Record<string, unknown>;
    const url = String(o.url ?? "").trim();
    if (!url.startsWith("data:")) return "unchanged";
    const decoded = decodeDataUrl(url);
    if (!decoded) return null;
    const name =
      (typeof o.name === "string" && o.name.trim()) ||
      (typeof o.fileName === "string" && o.fileName.trim()) ||
      inferNameFromUrl(url);
    const fileName =
      (typeof o.fileName === "string" && o.fileName.trim()) ||
      (typeof o.name === "string" && o.name.trim()) ||
      name;
    const uploaded = await uploadLegacyAttachmentToR2(decoded.buffer, decoded.mimeType, fileName);
    return buildDescriptorFromR2(uploaded, name, fileName);
  }
  return null;
}

export const summarizeAttachmentArray = (
  attachments: unknown
): { legacyCount: number; total: number } => {
  if (!Array.isArray(attachments)) return { legacyCount: 0, total: 0 };
  let legacyCount = 0;
  for (const it of attachments) {
    if (isLegacyAttachmentItem(it)) legacyCount += 1;
  }
  return { legacyCount, total: attachments.length };
};
