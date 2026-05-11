/** Zero-width and bidi marks that often slip into pasted Arabic/English text. */
const ZERO_WIDTH_AND_BIDI =
  /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF\u061C\u200C\u200D]/g;

const NBSP_LIKE = /[\u00A0\u202F\u2007\uFEFF]/g;

/** Strip HTML noise (comments, tags, nbsp) before visible-text checks — blocks “empty HTML” bypasses. */
export const stripHtmlNoiseForEmptyCheck = (raw: string): string => {
  let s = String(raw ?? "");
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  s = s.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
  s = s.replace(/<[^>]+>/g, "");
  s = s.replace(NBSP_LIKE, " ");
  return s;
};

/** Collapse whitespace after stripping invisible characters. */
export const normalizeAlumniStoryBody = (raw: string): string => {
  return String(raw ?? "")
    .normalize("NFKC")
    .replace(ZERO_WIDTH_AND_BIDI, "")
    .replace(/\s+/gu, " ")
    .trim();
};

/** True if there is at least one non-whitespace character (after normalization + HTML stripping). */
export const alumniStoryBodyHasVisibleText = (rawOrNormalized: string): boolean => {
  const cleaned = normalizeAlumniStoryBody(stripHtmlNoiseForEmptyCheck(rawOrNormalized));
  return cleaned.replace(/\s/gu, "").length > 0;
};
