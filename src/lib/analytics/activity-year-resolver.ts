/**
 * Central activity year resolution — analytics-only inference, no mandatory migration.
 * Priority: achievementYear → activityYear → competitionEdition → date → academicYear → createdAt
 */

export type ActivityYearSource =
  | "achievementYear"
  | "activityYear"
  | "competitionEdition"
  | "achievementDate"
  | "academicYear"
  | "createdAt";

export type ActivityYearInput = {
  achievementYear?: number | string | null;
  activityYear?: number | string | null;
  competitionEdition?: string | number | null;
  date?: Date | string | null;
  achievementDate?: Date | string | null;
  createdAt?: Date | string | null;
  academicYear?: string | null;
};

export type ResolvedActivityYear = {
  year: number | null;
  activityYearLabel: string;
  activityYearLabelAr: string;
  activityYearLabelEn: string;
  source: ActivityYearSource | null;
};

const CURRENT_MIN_YEAR = 1990;
const CURRENT_MAX_YEAR = 2100;

const safeTrim = (v: unknown): string => String(v ?? "").trim();

const parseYearNumber = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) {
    const y = Math.round(v);
    return y >= CURRENT_MIN_YEAR && y <= CURRENT_MAX_YEAR ? y : null;
  }
  const s = safeTrim(v);
  if (!s) return null;
  if (/^\d{4}$/.test(s)) {
    const y = Number(s);
    return y >= CURRENT_MIN_YEAR && y <= CURRENT_MAX_YEAR ? y : null;
  }
  const m = s.match(/(20\d{2})/);
  if (m) {
    const y = Number(m[1]);
    return y >= CURRENT_MIN_YEAR && y <= CURRENT_MAX_YEAR ? y : null;
  }
  return null;
};

const parseYearFromDate = (v: unknown): number | null => {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return parseYearNumber(v.getFullYear());
  }
  const s = safeTrim(v);
  if (!s) return null;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return parseYearNumber(d.getFullYear());
  return parseYearNumber(s);
};

const parseYearFromAcademicYear = (v: unknown): number | null => {
  const s = safeTrim(v);
  if (!s) return null;
  const matches = [...s.matchAll(/(20\d{2})/g)].map((m) => Number(m[1]));
  if (matches.length === 0) return null;
  return Math.min(...matches);
};

/** Extract year from achievement document / row fields. */
export const extractActivityYearFromAchievement = (
  input: ActivityYearInput | Record<string, unknown>,
  context?: { academicYear?: string | null }
): ResolvedActivityYear => {
  const doc = input as ActivityYearInput;
  const empty: ResolvedActivityYear = {
    year: null,
    activityYearLabel: "—",
    activityYearLabelAr: "—",
    activityYearLabelEn: "—",
    source: null,
  };

  const fromAchievementYear = parseYearNumber(doc.achievementYear);
  if (fromAchievementYear != null) {
    return wrapResolved(fromAchievementYear, "achievementYear");
  }

  const fromActivityYear = parseYearNumber(doc.activityYear);
  if (fromActivityYear != null) {
    return wrapResolved(fromActivityYear, "activityYear");
  }

  const edition = doc.competitionEdition;
  const fromEdition =
    parseYearNumber(edition) ?? parseYearFromDate(edition) ?? parseYearNumber(safeTrim(edition));
  if (fromEdition != null) {
    return wrapResolved(fromEdition, "competitionEdition");
  }

  const fromAchDate =
    parseYearFromDate(doc.achievementDate) ?? parseYearFromDate(doc.date);
  if (fromAchDate != null) {
    return wrapResolved(fromAchDate, "achievementDate");
  }

  const fromAcademic =
    parseYearFromAcademicYear(doc.academicYear) ??
    parseYearFromAcademicYear(context?.academicYear);
  if (fromAcademic != null) {
    return wrapResolved(fromAcademic, "academicYear");
  }

  const fromCreated = parseYearFromDate(doc.createdAt);
  if (fromCreated != null) {
    return wrapResolved(fromCreated, "createdAt");
  }

  return empty;
};

const wrapResolved = (year: number, source: ActivityYearSource): ResolvedActivityYear => ({
  year,
  activityYearLabel: buildActivityYearLabel(year, "ar"),
  activityYearLabelAr: buildActivityYearLabel(year, "ar"),
  activityYearLabelEn: buildActivityYearLabel(year, "en"),
  source,
});

export const buildActivityYearLabel = (year: number | null, loc: "ar" | "en"): string => {
  if (year == null) return loc === "ar" ? "—" : "—";
  return loc === "ar" ? `${year}م` : String(year);
};

/** Numeric activity year for filters / analytics. */
export const resolveActivityYear = (
  input: ActivityYearInput | Record<string, unknown>,
  context?: { academicYear?: string | null }
): number | null => extractActivityYearFromAchievement(input, context).year;

export const formatActivityEditionLabel = (
  activityName: string,
  year: number | null,
  loc: "ar" | "en"
): string => {
  const name = safeTrim(activityName) || (loc === "ar" ? "نشاط" : "Activity");
  if (year == null) return name;
  return loc === "ar" ? `${name} ${year}م` : `${name} ${year}`;
};

/** Dedupe and sort years descending for filter options. */
export const dedupeActivityYears = (years: Array<number | null | undefined>): number[] => {
  const s = new Set<number>();
  for (const y of years) {
    if (typeof y === "number" && Number.isFinite(y)) s.add(Math.round(y));
  }
  return [...s].sort((a, b) => b - a);
};
