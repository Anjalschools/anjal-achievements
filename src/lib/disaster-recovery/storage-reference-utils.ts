import { createHash } from "crypto";
import type { StorageProviderKind } from "@/lib/disaster-recovery/storage-manifest-types";

const isAbsoluteHttpUrl = (value: string): boolean => /^https?:\/\//i.test(value.trim());

const isCloudinaryUrl = (value: string): boolean =>
  /res\.cloudinary\.com/i.test(value) || /cloudinary\.com/i.test(value);

const isDataUrl = (value: string): boolean => /^data:/i.test(value.trim());

const isBareR2Key = (value: string): boolean => {
  const key = value.trim().replace(/^\/+/, "");
  if (!key || isAbsoluteHttpUrl(key)) return false;
  return (
    key.startsWith("achievements/attachments/") ||
    key.startsWith("partnerships/") ||
    key.startsWith("training/") ||
    key.startsWith("backups/")
  );
};

export const classifyStorageReference = (
  raw: string
): { provider: StorageProviderKind; storageKey: string } | null => {
  const value = raw.trim();
  if (!value) return null;
  if (isDataUrl(value)) {
    return { provider: "inline", storageKey: value };
  }
  if (value.startsWith("cloudinary://")) {
    return { provider: "cloudinary", storageKey: value };
  }
  if (isCloudinaryUrl(value)) {
    return { provider: "cloudinary", storageKey: value };
  }
  if (isAbsoluteHttpUrl(value)) {
    return { provider: "http", storageKey: value };
  }
  if (isBareR2Key(value)) {
    return { provider: "r2", storageKey: value.replace(/^\/+/, "") };
  }
  return null;
};

export const buildArchivePath = (provider: StorageProviderKind, storageKey: string): string => {
  if (provider === "inline") {
    const hash = createHash("sha256").update(storageKey).digest("hex").slice(0, 16);
    return `objects/inline/${hash}.bin`;
  }
  if (provider === "r2") {
    return `objects/r2/${storageKey.replace(/^\/+/, "")}`;
  }
  if (provider === "cloudinary") {
    const slug = storageKey.replace(/^https?:\/\//i, "").replace(/[^\w.-]+/g, "_");
    return `objects/cloudinary/${slug}`;
  }
  if (provider === "http") {
    const hash = createHash("sha256").update(storageKey).digest("hex").slice(0, 16);
    const extMatch = storageKey.toLowerCase().match(/\.(pdf|png|jpe?g|webp|gif)(?:\?|#|$)/);
    const ext = extMatch?.[1] || "bin";
    return `objects/http/${hash}.${ext}`;
  }
  return `objects/unknown/${createHash("sha256").update(storageKey).digest("hex").slice(0, 16)}.bin`;
};
