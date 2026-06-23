/**
 * Client-safe read-time URL resolution for training / institution attachments.
 * Does not mutate storage or trigger downloads.
 */

const DANGEROUS_PROTOCOL = /^\s*javascript:/i;

const trimPublicBase = (value: string | undefined): string =>
  String(value || "")
    .trim()
    .replace(/\/+$/, "");

const readR2PublicBaseUrl = (): string => {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL) {
    return trimPublicBase(process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL);
  }
  return "";
};

const isAbsoluteHttpUrl = (value: string): boolean => /^https?:\/\//i.test(value);

const isCloudinaryUrl = (value: string): boolean =>
  /res\.cloudinary\.com/i.test(value) || /cloudinary\.com/i.test(value);

/** Bare object keys stored by the R2 upload pipeline (legacy records). */
export const isBareR2AttachmentKey = (value: string): boolean => {
  const key = value.trim().replace(/^\/+/, "");
  if (!key || isAbsoluteHttpUrl(key)) return false;
  return (
    key.startsWith("achievements/attachments/") ||
    key.startsWith("partnerships/") ||
    key.startsWith("training/")
  );
};

export type AttachmentDisplayUrlResult = {
  url: string;
  resolvable: boolean;
  reason?: "missing" | "unsafe" | "unconfigured_base" | "non_http";
};

export const resolveAttachmentDisplayUrl = (storageKey: string): AttachmentDisplayUrlResult => {
  const key = String(storageKey || "").trim();
  if (!key) {
    return { url: "", resolvable: false, reason: "missing" };
  }
  if (DANGEROUS_PROTOCOL.test(key)) {
    return { url: "", resolvable: false, reason: "unsafe" };
  }

  if (isAbsoluteHttpUrl(key)) {
    return { url: key, resolvable: true };
  }

  if (isCloudinaryUrl(key)) {
    return { url: key, resolvable: true };
  }

  const base = readR2PublicBaseUrl();
  if (base && isBareR2AttachmentKey(key)) {
    const objectKey = key.replace(/^\/+/, "");
    return { url: `${base}/${objectKey}`, resolvable: true };
  }

  if (isBareR2AttachmentKey(key)) {
    return { url: "", resolvable: false, reason: "unconfigured_base" };
  }

  return { url: key, resolvable: !key.includes("://") ? false : true, reason: "non_http" };
};

/** Backward-compatible helper used across training UI components. */
export const attachmentDisplayUrl = (storageKey: string): string =>
  resolveAttachmentDisplayUrl(storageKey).url;

export const isAttachmentDisplayUrlResolvable = (storageKey: string): boolean =>
  resolveAttachmentDisplayUrl(storageKey).resolvable;
