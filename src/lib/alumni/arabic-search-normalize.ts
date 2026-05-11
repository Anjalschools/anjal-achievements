import { normalizeArabicDigits } from "@/lib/alumni/normalize-arabic-digits";

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const ZW_AND_BIDI = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF\u061C\u200C\u200D]/g;

/** Arabic combining marks (tashkeel) — removed so search matches typed or vocalized text. */
const ARABIC_DIACRITICS = /[\u064B-\u065F\u0670]/g;

/**
 * Normalizes a search token: Arabic digits, NFKC, tatweel/ZWSP removed, whitespace collapsed.
 * Hamza / alif variants are **not** collapsed here so {@link buildAlumniSearchRegexPattern} can expand them in regex.
 */
export const normalizeAlumniSearchToken = (raw: string): string => {
  let t = normalizeArabicDigits(String(raw ?? "").trim());
  if (!t) return "";
  t = t
    .normalize("NFKC")
    .replace(ZW_AND_BIDI, "")
    .replace(ARABIC_DIACRITICS, "")
    .replace(/\u0640/g, "")
    .replace(/\s+/gu, " ")
    .trim();
  return t.toLowerCase();
};

/**
 * Mongo-safe regex **pattern string** for alumni text search (Arabic-aware hamza/ta marbuta/ya).
 */
export const buildAlumniSearchRegexPattern = (token: string): string => {
  const t = normalizeAlumniSearchToken(token);
  if (!t) return "";
  if (!/[\u0600-\u06FF]/.test(t)) {
    return escapeRegExp(t);
  }
  return [...t]
    .map((ch) => {
      if ("أإآٱا".includes(ch)) return "[أإآٱا]";
      if ("ةه".includes(ch)) return "[ةه]";
      if ("ىي".includes(ch)) return "[ىي]";
      if (ch === "ؤ") return "[ؤو]";
      if (ch === "ئ") return "[ئي]";
      return escapeRegExp(ch);
    })
    .join("");
};
