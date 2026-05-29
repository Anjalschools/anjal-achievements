/**
 * Stable historical timeline — unifies calendar, academic, and Hijri year inputs.
 */

export type HistoricalYearSource = "calendar" | "academic" | "activity" | "hijri" | "unknown";

export type StableHistoricalYear = {
  /** Canonical start year (Gregorian) for column grouping */
  year: number;
  endYear: number;
  labelAr: string;
  labelEn: string;
  source: HistoricalYearSource;
  sortKey: number;
};

const ACADEMIC_RE = /(\d{4})\s*[-–]\s*(\d{4})/;
const HIJRI_RE = /(\d{3,4})\s*هـ?/i;
const CALENDAR_RE = /^(\d{4})$/;

export const parseYearToken = (token: string | number | null | undefined): number | null => {
  if (token == null || token === "") return null;
  if (typeof token === "number" && Number.isFinite(token)) {
    const y = Math.trunc(token);
    return y >= 2018 && y <= 2035 ? y : null;
  }
  const s = String(token).trim();
  if (!s || s === "." || s === "—" || s === "-") return null;

  const cal = s.match(CALENDAR_RE);
  if (cal) return Number(cal[1]);

  const acad = s.match(ACADEMIC_RE);
  if (acad) return Number(acad[1]);

  const hijri = s.match(HIJRI_RE);
  if (hijri) {
    const h = Number(hijri[1]);
    if (h >= 1400 && h <= 1500) return Math.round(h * 0.966) + 622;
  }

  const n = parseInt(s.replace(/[^\d]/g, ""), 10);
  if (Number.isFinite(n) && n >= 2018 && n <= 2035) return n;
  return null;
};

export const normalizeTimelineYears = (
  years: Array<string | number | null | undefined>,
  activityLabelAr = "",
  activityLabelEn = ""
): StableHistoricalYear[] => {
  const parsed = years
    .map((y) => parseYearToken(y))
    .filter((y): y is number => y != null);

  const unique = [...new Set(parsed)].sort((a, b) => a - b);

  return unique.map((year) => ({
    year,
    endYear: year + 1,
    labelAr: `${activityLabelAr} ${year}-${year + 1}`.trim(),
    labelEn: `${activityLabelEn} ${year}-${year + 1}`.trim(),
    source: "calendar" as HistoricalYearSource,
    sortKey: year,
  }));
};

export const mergeSlicesYears = (sliceYears: number[]): number[] => {
  const normalized = normalizeTimelineYears(sliceYears);
  return normalized.map((y) => y.year);
};

export const yearGroupLabel = (
  year: number,
  activityLabelAr: string,
  activityLabelEn: string,
  isAr: boolean
): string => {
  const stable = normalizeTimelineYears([year], activityLabelAr, activityLabelEn)[0];
  if (!stable) return String(year);
  return isAr ? stable.labelAr : stable.labelEn;
};
