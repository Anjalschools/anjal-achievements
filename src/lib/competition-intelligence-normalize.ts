/**
 * Single source for rounding / caps used across general report, focused, compare, PDF, and student intel UIs.
 * Import from here when adding new surfaces to avoid drift.
 */

/** Percentage 0–100, one decimal (matches common KPI cards). */
export const ciRoundPctOneDecimal = (n: number): number => Math.round(n * 10) / 10;

/** Ratio to percentage string with one decimal. */
export const ciMedalsPer100 = (medals: number, records: number): number => {
  if (records <= 0) return 0;
  return ciRoundPctOneDecimal((medals / records) * 100);
};

/** Integer counts for charts / tables. */
export const ciRoundCount = (n: number): number => Math.round(Number.isFinite(n) ? n : 0);

/** Cap long tail slices for chart stability (legend / DOM). */
export const CI_CHART_SLICE_CAP = 24;

export const ciCapChartEntries = <T>(rows: T[], cap = CI_CHART_SLICE_CAP): T[] =>
  rows.length <= cap ? rows : rows.slice(0, cap);

/** PDF / export participant row hard cap (align with API exportMax). */
export const CI_EXPORT_PARTICIPANT_ROW_CAP = 800;

/** Virtualized table threshold (aligned with focused panel). */
export const CI_VIRTUALIZATION_ROW_THRESHOLD = 300;

/** Compact filter line for PDF metadata / diagnostics (not exhaustive). */
export const ciBuildFiltersSummary = (
  f: {
    academicYear: string;
    gender: string;
    stage: string;
    grade: string;
    section: string;
    mawhiba: string;
    categories: string[];
    levels: string[];
    resultTokens: string[];
  },
  isAr: boolean
): string => {
  const parts = [
    `${isAr ? "عام" : "Yr"}:${f.academicYear}`,
    `${isAr ? "ج" : "G"}:${f.gender}`,
    `${isAr ? "مرحلة" : "Stg"}:${f.stage}`,
    `${isAr ? "صف" : "Gr"}:${f.grade}`,
    `${isAr ? "قسم" : "Sec"}:${f.section}`,
    `${isAr ? "موهبة" : "Mwb"}:${f.mawhiba}`,
  ];
  if (f.categories.length) parts.push(`${isAr ? "فئات" : "Cat"}:${f.categories.length}`);
  if (f.levels.length) parts.push(`${isAr ? "مستويات" : "Lvl"}:${f.levels.length}`);
  if (f.resultTokens.length) parts.push(`${isAr ? "نتائج" : "Res"}:${f.resultTokens.length}`);
  return parts.join(" · ");
};
