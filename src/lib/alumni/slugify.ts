import crypto from "node:crypto";

/** ASCII slug for URLs (announcements / events). */
export const slugifyLatin = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

/** Rough Arabic → Latin so mixed titles still yield a collision-resistant ASCII base slug. */
const ARABIC_TO_LATIN: Record<string, string> = {
  ا: "a",
  أ: "a",
  إ: "a",
  آ: "a",
  ٱ: "a",
  ب: "b",
  ت: "t",
  ث: "th",
  ج: "j",
  ح: "h",
  خ: "kh",
  د: "d",
  ذ: "dh",
  ر: "r",
  ز: "z",
  س: "s",
  ش: "sh",
  ص: "s",
  ض: "d",
  ط: "t",
  ظ: "z",
  ع: "a",
  غ: "gh",
  ف: "f",
  ق: "q",
  ك: "k",
  ل: "l",
  م: "m",
  ن: "n",
  ه: "h",
  و: "w",
  ؤ: "w",
  ي: "y",
  ئ: "y",
  ى: "a",
  ة: "h",
  ء: "",
};

export const transliterateArabicForLatinSlug = (value: string): string => {
  const s = value.normalize("NFKC");
  let out = "";
  for (const ch of s) {
    if (/\d/.test(ch)) {
      out += ch;
      continue;
    }
    const m = ARABIC_TO_LATIN[ch];
    if (m !== undefined) {
      out += m;
      continue;
    }
    if (/[a-z]/i.test(ch)) {
      out += ch.toLowerCase();
    }
  }
  return out;
};

/**
 * Prefer Latin slug from title; if too short (e.g. Arabic-only title), use transliteration fallback.
 */
export const slugifyWithTransliterationFallback = (value: string, maxLen = 120): string => {
  const direct = slugifyLatin(value);
  if (direct.replace(/-/g, "").length >= 2) return direct.slice(0, maxLen);
  const viaArab = slugifyLatin(transliterateArabicForLatinSlug(value));
  return viaArab.slice(0, maxLen);
};

/** URL-safe short suffix for slug collisions (nanoid-style, no extra deps). */
export const randomSlugCollisionSuffix = (): string =>
  crypto.randomBytes(6).toString("base64url").replace(/=/g, "").replace(/\+/g, "x").toLowerCase().slice(0, 10);
