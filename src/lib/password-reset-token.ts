import { createHash } from "node:crypto";

/** Raw token from `randomBytes(32).toString("hex")` — 64 lowercase hex chars */
export const RAW_RESET_TOKEN_HEX_LEN = 64;

const HEX64 = /^[a-f0-9]{64}$/;

export const hashResetToken = (rawToken: string): string =>
  createHash("sha256").update(rawToken, "utf8").digest("hex");

/**
 * Normalize token from URL / JSON: trim, lowercase, single URI decode.
 * Rejects values that are not exactly 64 hex chars after normalize (wrong encoding / truncation).
 */
export const normalizeRawResetToken = (raw: string): { ok: true; token: string } | { ok: false } => {
  let s = raw.trim();
  try {
    s = decodeURIComponent(s);
  } catch {
    return { ok: false };
  }
  s = s.trim().toLowerCase();
  if (!HEX64.test(s)) {
    return { ok: false };
  }
  return { ok: true, token: s };
};

export const resetPasswordDebugEnabled = (): boolean =>
  process.env.RESET_PASSWORD_DEBUG === "1" || process.env.NODE_ENV === "development";
