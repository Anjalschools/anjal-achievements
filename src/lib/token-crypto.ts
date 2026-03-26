import crypto from "crypto";

const IV_LEN = 16;
const AUTH_TAG_LEN = 16;

const getKey = (): Buffer | null => {
  const raw = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY?.trim();
  if (!raw) return null;
  try {
    if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
    const k = crypto.createHash("sha256").update(raw, "utf8").digest();
    return k;
  } catch {
    return null;
  }
};

/** Returns base64 payload iv:cipher:tag or null if encryption unavailable. */
export const encryptSecret = (plain: string): string | null => {
  const key = getKey();
  if (!key || !plain) return null;
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
};

export const decryptSecret = (stored: string): string | null => {
  const key = getKey();
  if (!key || !stored) return null;
  try {
    const buf = Buffer.from(stored, "base64");
    if (buf.length < IV_LEN + AUTH_TAG_LEN + 1) return null;
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + AUTH_TAG_LEN);
    const data = buf.subarray(IV_LEN + AUTH_TAG_LEN);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(data) + decipher.final("utf8");
  } catch {
    return null;
  }
};

export const isTokenEncryptionConfigured = (): boolean => getKey() !== null;
