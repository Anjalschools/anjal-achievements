/**
 * Shared quadruple-name validation (Arabic + English) for registration.
 * Rules: trim, collapse spaces, require ≥4 non-empty space-separated parts; per-part script checks.
 */

/** Collapse internal whitespace and trim ends */
export const normalizeFullName = (raw: string): string => raw.replace(/\s+/g, " ").trim();

/** Count space-separated parts after normalization (0 if empty) */
export const countNameParts = (raw: string): number => {
  const n = normalizeFullName(raw);
  if (!n) return 0;
  return n.split(" ").length;
};

/** One Arabic token: Arabic script blocks + common presentation forms (Hamza, Tatweel, etc.) */
const ARABIC_NAME_PART =
  /^[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0670\u0640]+$/u;

/** Latin letters with optional internal hyphen / apostrophe (e.g. Jean-Pierre, O'Brien) */
const ENGLISH_NAME_PART = /^[A-Za-z\u00C0-\u024F]+(?:['-][A-Za-z\u00C0-\u024F]+)*$/;

const MIN_PARTS = 4;

export const isValidArabicFullName = (raw: string): boolean => {
  const n = normalizeFullName(raw);
  if (!n) return false;
  const parts = n.split(" ");
  if (parts.length < MIN_PARTS) return false;
  return parts.every((p) => ARABIC_NAME_PART.test(p));
};

export const isValidEnglishFullName = (raw: string): boolean => {
  const n = normalizeFullName(raw);
  if (!n) return false;
  const parts = n.split(" ");
  if (parts.length < MIN_PARTS) return false;
  return parts.every((p) => ENGLISH_NAME_PART.test(p));
};
