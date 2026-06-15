/**
 * Document fingerprint helpers — same sha256 / storage-key patterns used for
 * attachment AI review signatures and alumni memory dedupe.
 */

import { createHash } from "crypto";

export const computeBufferContentFingerprint = (buffer: Buffer): string =>
  createHash("sha256").update(buffer).digest("hex");

/** Stable fingerprint from a public storage URL or R2 key tail. */
export const computeStorageKeyFingerprint = (storageKey: string): string => {
  const key = String(storageKey || "").trim().toLowerCase();
  if (!key) return "";
  try {
    const noQuery = key.split("?")[0] || key;
    const parts = noQuery.split("/").filter(Boolean);
    const tail = parts.slice(-4).join("/");
    if (tail) return tail;
  } catch {
    /* fall through */
  }
  return createHash("sha256").update(key).digest("hex").slice(0, 40);
};

export const computeDocumentFingerprint = (input: {
  buffer?: Buffer | null;
  storageKey?: string | null;
}): string => {
  if (input.buffer && input.buffer.length > 0) {
    return computeBufferContentFingerprint(input.buffer);
  }
  return computeStorageKeyFingerprint(input.storageKey || "");
};
