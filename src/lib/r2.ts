import "server-only";
import { randomBytes } from "crypto";
import { extname } from "path";
import {
  buildR2PublicUrlFromResolved,
  createOrGetR2S3Client,
  isR2S3ConfigValid,
  validateR2S3CredentialsOrThrow,
} from "./storage/r2-config";

export { validateR2S3CredentialsOrThrow, isR2S3ConfigValid } from "./storage/r2-config";

/** @deprecated Use isR2S3ConfigValid — kept for call-site compatibility */
export const isR2Configured = (): boolean => isR2S3ConfigValid();

export const assertR2Env = (): void => {
  validateR2S3CredentialsOrThrow();
};

export const getR2Client = () => createOrGetR2S3Client().client;

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

/** Object key: home-gallery/{albumKey}/{yyyy}/{mm}/{random}{ext} */
export const buildHomeGalleryR2Key = (albumKey: string, originalFilename: string): string => {
  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const id = randomBytes(16).toString("hex");
  const ext = safeFileExtension(originalFilename);
  const safeAlbum = (albumKey || "home-ceremony").replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  return `home-gallery/${safeAlbum}/${yyyy}/${mm}/${id}${ext}`;
};

/** Public URL for a stored object key (R2 public bucket / custom domain). */
export const buildR2PublicObjectUrl = (key: string): string => {
  const { settings } = createOrGetR2S3Client();
  return buildR2PublicUrlFromResolved(settings, key);
};

export const getR2BucketName = (): string => createOrGetR2S3Client().settings.bucket;
