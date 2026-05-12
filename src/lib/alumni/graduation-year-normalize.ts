import { normalizeArabicDigits, parseGraduationYearToken } from "@/lib/alumni/normalize-arabic-digits";

/**
 * Canonical numeric graduation year for queries and cohort keys.
 * Accepts stored number, ASCII / Eastern Arabic digit strings.
 */
export const normalizeGraduationYearToNumber = (raw: unknown): number | undefined => {
  if (raw == null) return undefined;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const n = Math.trunc(raw);
    return n >= 1950 && n <= 2100 ? n : undefined;
  }
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return undefined;
    const fromToken = parseGraduationYearToken(t);
    if (fromToken != null) return fromToken;
    const n = Math.trunc(Number(normalizeArabicDigits(t)));
    if (Number.isFinite(n) && n >= 1950 && n <= 2100) return n;
  }
  return undefined;
};

/** Values to pass in Mongo `$in` so both numeric and legacy string years match. */
export const graduationYearMongoInList = (years: number[]): (number | string)[] => {
  const out: (number | string)[] = [];
  const seen = new Set<string>();
  for (const raw of years) {
    const y = Math.trunc(Number(raw));
    if (!Number.isFinite(y) || y < 1950 || y > 2100) continue;
    for (const v of [y, String(y)] as const) {
      const key = `${typeof v}:${v}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(v);
    }
  }
  return out;
};

export const mongoMatchAlumniGraduationYears = (years: number[]): Record<string, unknown> | null => {
  const variants = graduationYearMongoInList(years);
  if (!variants.length) return null;
  return { "alumniProfile.graduationYear": { $in: variants } };
};

export const mongoMatchAlumniGraduationYearEquals = (year: number): Record<string, unknown> | null => {
  const variants = graduationYearMongoInList([year]);
  if (!variants.length) return null;
  return { "alumniProfile.graduationYear": { $in: variants } };
};
