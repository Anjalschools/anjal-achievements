/** Maps Eastern Arabic / Persian digits to ASCII 0–9 for numeric parsing. */
const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";
const EXT_ARABIC_INDIC = "۰۱۲۳۴۵۶۷۸۹";

export const normalizeArabicDigits = (input: string): string => {
  let out = "";
  for (const ch of String(input || "")) {
    const i = ARABIC_INDIC.indexOf(ch);
    if (i !== -1) {
      out += String(i);
      continue;
    }
    const j = EXT_ARABIC_INDIC.indexOf(ch);
    if (j !== -1) {
      out += String(j);
      continue;
    }
    out += ch;
  }
  return out;
};

/** Parse graduation year from user input (supports ٢٠٢٣ → 2023). Returns undefined if not a valid year token. */
export const parseGraduationYearToken = (token: string): number | undefined => {
  const t = normalizeArabicDigits(token).trim();
  if (!/^\d{4}$/.test(t)) return undefined;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  if (n < 1950 || n > 2100) return undefined;
  return n;
};
