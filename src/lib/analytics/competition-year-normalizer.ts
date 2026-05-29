/**
 * Academic year normalization — single source for competition tables, KPIs, exports.
 * Convention: column key = academic start year (e.g. 2025 → label "2025-2026").
 */

/** Saudi/Gregorian academic year typically starts in September */
export const ACADEMIC_YEAR_START_MONTH = 9;

const MIN_YEAR = 1990;
const MAX_YEAR = 2100;

const parseYearNumber = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) {
    const y = Math.round(v);
    return y >= MIN_YEAR && y <= MAX_YEAR ? y : null;
  }
  const s = String(v ?? "").trim();
  if (!/^\d{4}$/.test(s)) return null;
  const y = Number(s);
  return y >= MIN_YEAR && y <= MAX_YEAR ? y : null;
};

/** First year in an academic range string (e.g. "2025-2026م" → 2025). */
export const parseAcademicYearStartFromText = (raw: string | null | undefined): number | null => {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const matches = [...s.matchAll(/20\d{2}/g)].map((m) => Number(m[0]));
  if (matches.length === 0) return null;
  return Math.min(...matches);
};

export type AcademicYearResolveInput = {
  achievementYear?: number | string | null;
  activityYear?: number | string | null;
  achievementDate?: Date | string | null;
  date?: Date | string | null;
  academicYear?: string | null;
};

/**
 * Resolve the academic **start** year for bucketing and labels.
 * Priority: achievementDate → explicit achievementYear/activityYear → academicYear text.
 */
export const resolveAcademicStartYear = (input: AcademicYearResolveInput): number | null => {
  const dateRaw = input.achievementDate ?? input.date;
  if (dateRaw) {
    const d =
      dateRaw instanceof Date
        ? dateRaw
        : new Date(String(dateRaw).slice(0, 10));
    if (!Number.isNaN(d.getTime())) {
      const calYear = d.getFullYear();
      const month = d.getMonth() + 1;
      return month >= ACADEMIC_YEAR_START_MONTH ? calYear : calYear - 1;
    }
  }

  const fromAchievementYear = parseYearNumber(input.achievementYear);
  if (fromAchievementYear != null) return fromAchievementYear;

  const fromActivityYear = parseYearNumber(input.activityYear);
  if (fromActivityYear != null) return fromActivityYear;

  const fromAcademic = parseAcademicYearStartFromText(input.academicYear);
  if (fromAcademic != null) return fromAcademic;

  return null;
};

/** Format start year as academic range label (no +1 drift). */
export const formatAcademicYearRangeLabel = (startYear: number): string =>
  `${startYear}-${startYear + 1}`;

export const normalizeAcademicYearLabel = (
  startYear: number,
  options?: { titleAr?: string; titleEn?: string; locale?: "ar" | "en" }
): { labelAr: string; labelEn: string; startYear: number; endYear: number } => {
  const range = formatAcademicYearRangeLabel(startYear);
  const titleAr = options?.titleAr?.trim() ?? "";
  const titleEn = options?.titleEn?.trim() ?? "";
  return {
    startYear,
    endYear: startYear + 1,
    labelAr: titleAr ? `${titleAr} ${range}` : range,
    labelEn: titleEn ? `${titleEn} ${range}` : range,
  };
};
