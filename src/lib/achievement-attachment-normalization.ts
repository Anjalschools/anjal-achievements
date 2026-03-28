/**
 * Normalization + light extraction helpers for achievement attachment / certificate text.
 * Used by deterministic guardrails after AI review (not a substitute for human judgment).
 */

const ARABIC_DIACRITICS_RE = /[\u064B-\u065F\u0670\u0610-\u061A\u06D6-\u06ED]/g;
const TATWEEL = /\u0640/g;

/** Remove Arabic harakat / diacritics and tatweel (kashida). */
export const stripArabicDiacriticsAndTatweel = (s: string): string =>
  s.replace(ARABIC_DIACRITICS_RE, "").replace(TATWEEL, "");

/** Map common Arabic letter variants for fuzzy comparison. */
export const normalizeArabicLetters = (s: string): string => {
  let t = stripArabicDiacriticsAndTatweel(s);
  t = t.replace(/[أإآٱ]/g, "ا");
  t = t.replace(/ى/g, "ي");
  t = t.replace(/ؤ/g, "و");
  t = t.replace(/ئ/g, "ي");
  t = t.replace(/ة/g, "ه");
  return t;
};

export const collapseWhitespace = (s: string): string => s.replace(/\s+/g, " ").trim();

/** Lowercase Latin, collapse spaces, drop non-essential punctuation (keep digits). */
export const normalizeEnglishForCompare = (s: string): string => {
  const t = s.normalize("NFKC").toLowerCase();
  return collapseWhitespace(t.replace(/[^\p{L}\p{N}\s]/gu, " "));
};

/** Convert Arabic-Indic / Eastern digits to Western ASCII digits in a string. */
export const normalizeDigitsInString = (s: string): string => {
  let out = "";
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    if (c >= 0x0660 && c <= 0x0669) {
      out += String(c - 0x0660);
      continue;
    }
    if (c >= 0x06f0 && c <= 0x06f9) {
      out += String(c - 0x06f0);
      continue;
    }
    out += ch;
  }
  return out;
};

/** Full normalization pipeline for mixed Arabic/English certificate snippets. */
export const normalizeCertificateSnippet = (s: string): string => {
  const withDigits = normalizeDigitsInString(s);
  // Split runs: rough approach — normalize Arabic letters on full string, then English pass on Latin tokens
  const ar = normalizeArabicLetters(withDigits);
  return collapseWhitespace(ar);
};

const removeSeparatorsFromName = (s: string): string =>
  normalizeCertificateSnippet(s).replace(/[/|\\._\-،,]+/g, " ");

/** Normalize personal names for comparison (Arabic + English tolerant). */
export const normalizeNameForCompare = (s: string): string => {
  let t = removeSeparatorsFromName(s);
  t = normalizeEnglishForCompare(t);
  t = t.replace(/\b(bin|ibn|bint|abu|abou|umm|um)\b/gi, " ");
  t = collapseWhitespace(t.replace(/[^\p{L}\p{N}\s]/gu, " "));
  return t;
};

const tokenize = (s: string): string[] =>
  normalizeEnglishForCompare(s)
    .split(/\s+/)
    .map((x) => x.trim())
    .filter((x) => x.length > 0);

const significantNameTokens = (tokens: string[]): string[] =>
  tokens.filter((t) => t.length >= 2 && !/^\d+$/.test(t));

/** Jaccard-like overlap on significant tokens. */
export const tokenSetOverlapRatio = (a: string, b: string): number => {
  const A = new Set(significantNameTokens(tokenize(a)));
  const B = new Set(significantNameTokens(tokenize(b)));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const x of A) {
    if (B.has(x)) inter += 1;
  }
  const union = A.size + B.size - inter;
  return union <= 0 ? 0 : inter / union;
};

/** Substring containment after normalization (either direction). */
export const normalizedContainsEitherWay = (a: string, b: string): boolean => {
  const na = collapseWhitespace(normalizeNameForCompare(a));
  const nb = collapseWhitespace(normalizeNameForCompare(b));
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
};

export type NameMatchStrength = "strong" | "weak" | "none";

/**
 * Compare a detected/free-text name against system names (Arabic/English/full).
 * Conservative: strong only with good overlap or clear containment.
 */
/** Drop optional Arabic nasab tokens so "محمد بن حسين" aligns with "محمد حسين" in records. */
export const relaxArabicNameForTokenCompare = (s: string): string =>
  collapseWhitespace(
    normalizeNameForCompare(s)
      .replace(/\bبن\b/gi, " ")
      .replace(/\bابن\b/gi, " ")
      .replace(/\bبنت\b/gi, " ")
  );

export const compareStudentNameToRecord = (input: {
  detected: string | null | undefined;
  systemNames: string[];
}): { strength: NameMatchStrength } => {
  const det = String(input.detected || "").trim();
  if (!det) return { strength: "none" };
  const sys = input.systemNames.map((x) => String(x || "").trim()).filter(Boolean);
  if (sys.length === 0) return { strength: "none" };

  const detR = relaxArabicNameForTokenCompare(det);

  let best = 0;
  let bestContain = false;
  for (const s of sys) {
    const sR = relaxArabicNameForTokenCompare(s);
    const ratio = Math.max(
      tokenSetOverlapRatio(det, s),
      tokenSetOverlapRatio(detR, sR),
      tokenSetOverlapRatio(detR, s),
      tokenSetOverlapRatio(det, sR)
    );
    best = Math.max(best, ratio);
    if (normalizedContainsEitherWay(det, s) || normalizedContainsEitherWay(detR, sR)) bestContain = true;
  }

  if (bestContain || best >= 0.55) return { strength: "strong" };
  if (best >= 0.35) return { strength: "weak" };
  return { strength: "none" };
};

const YEAR_RE = /\b(19|20)\d{2}\b/g;

/** Collect 4-digit Gregorian years from mixed Arabic/Latin text. */
export const extractYearsFromText = (text: string): number[] => {
  const t = normalizeDigitsInString(text);
  const out = new Set<number>();
  let m: RegExpExecArray | null;
  const re = new RegExp(YEAR_RE.source, "g");
  for (;;) {
    m = re.exec(t);
    if (!m) break;
    const n = parseInt(m[0], 10);
    if (n >= 1900 && n <= 2100) out.add(n);
  }
  return [...out].sort((a, b) => a - b);
};

export const parseRecordYear = (yearRaw: string | number | null | undefined): number | null => {
  if (yearRaw === null || yearRaw === undefined) return null;
  const s = normalizeDigitsInString(String(yearRaw).trim());
  const m = s.match(/\b(19|20)\d{2}\b/);
  if (!m) return null;
  const n = parseInt(m[0], 10);
  return n >= 1900 && n <= 2100 ? n : null;
};

/**
 * Year alignment: same calendar year anywhere in text counts as support.
 * Does not treat unrelated years as contradiction unless `strictContradiction` finds a lone conflicting year.
 */
export const yearAppearsInText = (recordYear: number | null, text: string): boolean => {
  if (recordYear === null) return false;
  const years = extractYearsFromText(text);
  return years.includes(recordYear);
};

export type TitleMatchStrength = "strong" | "weak" | "none";

const titleTokens = (s: string): string[] => {
  const n = normalizeCertificateSnippet(normalizeEnglishForCompare(s));
  return significantNameTokens(tokenize(n));
};

/** Token overlap between recorded achievement title(s) and certificate title text (conservative). */
export const compareAchievementTitles = (input: {
  recordTitles: string[];
  detectedTitle: string | null | undefined;
  fullText?: string;
}): { strength: TitleMatchStrength; ratio: number } => {
  const det = String(input.detectedTitle || "").trim();
  const corpus = [det, String(input.fullText || "")].filter(Boolean).join(" ");
  const rec = input.recordTitles.map((x) => String(x || "").trim()).filter(Boolean);
  if (!corpus || rec.length === 0) return { strength: "none", ratio: 0 };

  let best = 0;
  const C = new Set(titleTokens(corpus));
  if (C.size === 0) return { strength: "none", ratio: 0 };

  for (const r of rec) {
    const R = new Set(titleTokens(r));
    if (R.size === 0) continue;
    let inter = 0;
    for (const x of R) {
      if (C.has(x)) inter += 1;
    }
    const ratio = inter / R.size;
    best = Math.max(best, ratio);
  }

  if (best >= 0.5) return { strength: "strong", ratio: best };
  if (best >= 0.28) return { strength: "weak", ratio: best };
  return { strength: "none", ratio: best };
};

export type MedalClass = "gold" | "silver" | "bronze" | "participation" | "award" | "rank" | "unknown";

const MEDAL_SYNONYMS: ReadonlyArray<{ re: RegExp; cls: MedalClass }> = [
  { re: /(ميدالية\s*ذهبية|ذهبية|gold\s*medal|gold_medal|\bgold\b)/i, cls: "gold" },
  { re: /(ميدالية\s*فضية|فضية|silver\s*medal|silver_medal|\bsilver\b)/i, cls: "silver" },
  { re: /(ميدالية\s*برونزية|برونزية|bronze\s*medal|bronze_medal|\bbronze\b)/i, cls: "bronze" },
  { re: /(مشاركة|participation)/i, cls: "participation" },
  { re: /(جائزة|award|prize)/i, cls: "award" },
  { re: /(المركز\s*الأول|المركز\s*الثاني|المركز\s*الثالث|\brank\b|\bplace\b)/i, cls: "rank" },
];

export const detectMedalClassInText = (text: string): MedalClass => {
  const t = collapseWhitespace(normalizeDigitsInString(text));
  const tAscii = normalizeEnglishForCompare(t);
  const scan = `${t} ${tAscii}`;
  for (const { re, cls } of MEDAL_SYNONYMS) {
    if (re.test(scan)) return cls;
  }
  return "unknown";
};

export const medalClassFromRecord = (input: {
  medalType?: string;
  resultType?: string;
  rank?: string;
}): MedalClass => {
  const m = normalizeEnglishForCompare(String(input.medalType || ""));
  const r = normalizeEnglishForCompare(String(input.resultType || ""));
  const rk = normalizeEnglishForCompare(String(input.rank || ""));
  const blob = `${m} ${r} ${rk}`;
  if (/gold|ذهب/.test(blob)) return "gold";
  if (/silver|فض/.test(blob)) return "silver";
  if (/bronze|برونز/.test(blob)) return "bronze";
  if (/participat|مشارك/.test(blob)) return "participation";
  if (/award|prize|جائز/.test(blob)) return "award";
  if (/rank|مركز|place/.test(blob)) return "rank";
  return "unknown";
};

/** True when text and record agree on medal tier when both are specific. */
export const medalCompatibleWithRecord = (text: string, record: { medalType?: string; resultType?: string; rank?: string }): boolean => {
  const rc = medalClassFromRecord(record);
  const tc = detectMedalClassInText(text);
  if (rc === "unknown" || tc === "unknown") return false;
  if (rc === "award" || rc === "rank" || tc === "award" || tc === "rank") {
    return rc === tc;
  }
  return rc === tc;
};

const LEVEL_HINTS: ReadonlyArray<{ re: RegExp; label: string }> = [
  { re: /(دولي|international|olympiad\s*international|ioi|imo|ipho)/i, label: "international" },
  { re: /(الملكية|وطني|kingdom|national)/i, label: "national" },
  { re: /(المملكة|السعودية|ksa)/i, label: "ksa" },
  { re: /(إقليمي|منطقة|regional)/i, label: "regional" },
  { re: /(محافظة|province)/i, label: "province" },
  { re: /(مدرسة|school)/i, label: "school" },
];

export const detectLevelHintsInText = (text: string): string[] => {
  const t = normalizeCertificateSnippet(text);
  const out: string[] = [];
  for (const { re, label } of LEVEL_HINTS) {
    if (re.test(t)) out.push(label);
  }
  return out;
};

export const normalizeLevelKey = (levelRaw: string): string =>
  collapseWhitespace(normalizeEnglishForCompare(String(levelRaw || "")));

/**
 * Very light level compatibility — conservative: only "strong" when record level keyword appears in text.
 * Missing evidence must NOT imply mismatch (caller should use unclear).
 */
export const levelTextSupportsRecord = (recordLevel: string, text: string): "support" | "none" => {
  const rl = normalizeLevelKey(recordLevel);
  if (!rl) return "none";
  const tl = normalizeLevelKey(text);
  if (!tl) return "none";
  if (tl.includes(rl) || rl.includes(tl)) return "support";
  // Arabic/English common enums: check token overlap
  if (tokenSetOverlapRatio(recordLevel, text) >= 0.34) return "support";
  return "none";
};

export const countLettersInString = (s: string): number => {
  let n = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    const letter =
      (c >= 0x0610 && c <= 0x06ff) || // Arabic block (broad)
      (c >= 0x0750 && c <= 0x077f) ||
      (c >= 0xfb50 && c <= 0xfdff) ||
      (c >= 0xfe70 && c <= 0xfeff) ||
      ((c >= 0x0041 && c <= 0x005a) || (c >= 0x0061 && c <= 0x007a));
    if (letter) n += 1;
  }
  return n;
};

export const countScriptBoundarySwitches = (s: string): number => {
  let switches = 0;
  let prev: "ar" | "lat" | "other" = "other";
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    const isLat = (c >= 0x0041 && c <= 0x005a) || (c >= 0x0061 && c <= 0x007a);
    const isAr =
      (c >= 0x0600 && c <= 0x06ff) ||
      (c >= 0x0750 && c <= 0x077f) ||
      (c >= 0xfb50 && c <= 0xfdff) ||
      (c >= 0xfe70 && c <= 0xfeff);
    const cur: "ar" | "lat" | "other" = isAr ? "ar" : isLat ? "lat" : "other";
    if (cur !== "other" && prev !== "other" && cur !== prev) switches += 1;
    if (cur !== "other") prev = cur;
  }
  return switches;
};

/** Heuristic PDF text quality before AI review (raw extractor output, may include newlines). */
export type PdfTextReliability = {
  lowTextReliability: boolean;
  reasons: string[];
  letterCount: number;
  rawCharCount: number;
};

export const assessPdfExtractedTextReliability = (rawText: string): PdfTextReliability => {
  const trimmed = rawText.trim();
  const rawCharCount = trimmed.length;
  const letterCount = countLettersInString(trimmed);
  const reasons: string[] = [];

  if (letterCount < 28) reasons.push("very_few_letters");

  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length >= 6) {
    const shortLines = lines.filter((l) => l.length <= 2).length;
    if (shortLines / lines.length > 0.32) reasons.push("fragmented_lines");
  }
  if (lines.length >= 10) {
    const tiny = lines.filter((l) => l.length <= 3).length;
    if (tiny / lines.length > 0.38) reasons.push("many_very_short_lines");
  }
  const singleCharLines = lines.filter((l) => l.length === 1).length;
  if (lines.length >= 8 && singleCharLines >= 2) {
    reasons.push("repeated_single_character_lines");
  }

  if (rawCharCount > 0) {
    const weird = trimmed.replace(/[\p{L}\p{N}\s]/gu, "").length;
    if (weird / rawCharCount > 0.14) reasons.push("high_symbol_noise");
  }

  const switches = countScriptBoundarySwitches(trimmed);
  if (letterCount > 50 && switches > Math.max(18, letterCount / 5)) {
    reasons.push("heavy_script_alternation");
  }

  const lowTextReliability =
    letterCount < 40 ||
    reasons.includes("very_few_letters") ||
    reasons.includes("many_very_short_lines") ||
    reasons.includes("repeated_single_character_lines") ||
    reasons.filter((r) => r !== "heavy_script_alternation").length >= 2 ||
    (letterCount < 95 && reasons.length >= 1);

  return { lowTextReliability, reasons, letterCount, rawCharCount };
};
