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
    genders?: string[];
    stage: string;
    stages?: string[];
    grade: string;
    grades?: string[];
    section: string;
    sections?: string[];
    mawhiba: string;
    mawhibaValues?: string[];
    activityYears?: string[];
    achievementNames?: string[];
    categories: string[];
    levels: string[];
    resultTokens: string[];
    statuses?: string[];
    certificateStatuses?: string[];
    standardizedTestTypes?: string[];
  },
  isAr: boolean
): string => {
  const parts = [`${isAr ? "عام" : "Yr"}:${f.academicYear}`];
  const genders = f.genders?.length ? f.genders : f.gender !== "all" ? [f.gender] : [];
  if (genders.length) parts.push(`${isAr ? "ج" : "G"}:${genders.join(",")}`);
  const stages = f.stages?.length ? f.stages : f.stage !== "all" ? [f.stage] : [];
  if (stages.length) parts.push(`${isAr ? "مرحلة" : "Stg"}:${stages.join(",")}`);
  const grades = f.grades?.length ? f.grades : f.grade !== "all" ? [f.grade] : [];
  if (grades.length) parts.push(`${isAr ? "صف" : "Gr"}:${grades.join(",")}`);
  const sections = f.sections?.length ? f.sections : f.section !== "all" ? [f.section] : [];
  if (sections.length) parts.push(`${isAr ? "قسم" : "Sec"}:${sections.join(",")}`);
  const maw = f.mawhibaValues?.length ? f.mawhibaValues : f.mawhiba !== "all" ? [f.mawhiba] : [];
  if (maw.length) parts.push(`${isAr ? "موهبة" : "Mwb"}:${maw.join(",")}`);
  if (f.activityYears?.length) parts.push(`${isAr ? "سنة" : "ActYr"}:${f.activityYears.join(",")}`);
  if (f.achievementNames?.length) parts.push(`${isAr ? "أنشطة" : "Act"}:${f.achievementNames.length}`);
  if (f.categories.length) parts.push(`${isAr ? "فئات" : "Cat"}:${f.categories.length}`);
  if (f.levels.length) parts.push(`${isAr ? "مستويات" : "Lvl"}:${f.levels.length}`);
  if (f.resultTokens.length) parts.push(`${isAr ? "نتائج" : "Res"}:${f.resultTokens.length}`);
  if (f.statuses?.length) parts.push(`${isAr ? "حالة" : "St"}:${f.statuses.length}`);
  if (f.certificateStatuses?.length) parts.push(`${isAr ? "شهادة" : "Cert"}:${f.certificateStatuses.length}`);
  if (f.standardizedTestTypes?.length) parts.push(`${isAr ? "اختبار" : "Test"}:${f.standardizedTestTypes.length}`);
  return parts.join(" · ");
};
