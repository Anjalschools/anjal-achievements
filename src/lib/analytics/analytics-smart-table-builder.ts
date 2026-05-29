/**
 * Auto-detect best historical table presentation from filters + payloads.
 */

import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";
import type { ExecutiveFilterSnapshot } from "@/lib/competition-intelligence-persistence";
import {
  ACTIVITY_FAMILIES,
  type ActivityFamilyDef,
  type ComparisonTableMode,
  type HistoricalComparisonTableModel,
} from "@/lib/analytics/historical-comparison-table-engine";
import type { MatrixTableModel } from "@/lib/analytics/shared/historical-matrix-types";
import { detectFamiliesWithData } from "@/lib/analytics/historical-activity-resolution";
import type { HistoricalYearSlice } from "@/lib/analytics/historical-comparison-fetch";
import { normalizeHistoricalYears } from "@/lib/analytics/historical-comparison-fetch";
import type { MatrixDebugMeta } from "@/lib/analytics/historical-matrix-model";
import { resolveHistoricalIntelligenceBundle } from "@/lib/analytics/historical-resolution-pipeline";
import type { HistoricalTableDisplayMode } from "@/lib/analytics/historical-executive-table-theme";
import type { HistoricalFallbackResult } from "@/lib/analytics/historical-fallback-strategies";
import type { HistoricalResolutionMeta } from "@/lib/analytics/historical-resolution-pipeline";

export type SmartTablePlan = {
  families: ActivityFamilyDef[];
  years: number[];
  mode: ComparisonTableMode;
  includeMatrix: boolean;
  sectionTitleAr: string;
  sectionTitleEn: string;
};

const detectFamiliesFromFilter = (
  f: ExecutiveFilterSnapshot,
  slices: HistoricalYearSlice[]
): ActivityFamilyDef[] => {
  const data = slices[slices.length - 1]?.payload ?? null;
  const names = [
    ...f.achievementNames,
    ...(data?.activityOptions?.map((o) => o.labelEn) ?? []),
  ]
    .join(" ")
    .toLowerCase();

  if (/kangaroo|كانجارو/.test(names)) {
    return ACTIVITY_FAMILIES.filter((x) => x.key === "kangaroo");
  }
  if (/bebras|بيبراس/.test(names)) {
    return ACTIVITY_FAMILIES.filter((x) => x.key === "bebras");
  }
  if (/srsi/.test(names)) {
    return ACTIVITY_FAMILIES.filter((x) => x.key === "srsi");
  }
  if (/sat|ielts|قدرات|تحصيلي/.test(names)) {
    return ACTIVITY_FAMILIES.filter((x) => x.tableType === "standardized_testing");
  }
  if (/mawhiba|موهبة|موهوب/.test(names)) {
    return ACTIVITY_FAMILIES.filter((x) => x.tableType === "talent_discovery");
  }
  if (/olympiad|أولمبياد|ibdaa|إبداع/.test(names)) {
    return ACTIVITY_FAMILIES.filter((x) => x.tableType === "qualification_acceptance");
  }

  const prefer: string[] = [];
  if (/kangaroo|كانجارو/.test(names)) prefer.push("kangaroo");
  if (/bebras|بيبراس/.test(names)) prefer.push("bebras");
  if (/srsi/.test(names)) prefer.push("srsi");
  if (/sat/.test(names)) prefer.push("sat");
  if (/ielts|آيلتس/.test(names)) prefer.push("ielts");
  if (/mawhiba|موهبة|موهوب/.test(names)) prefer.push("mawhiba_discovery");
  if (/olympiad|أولمبياد|ibdaa|إبداع|isef/.test(names)) prefer.push("ibdaa", "olympiad_training");

  if (slices.length > 0) {
    return detectFamiliesWithData(slices, prefer.length > 0 ? prefer : undefined).slice(0, 8);
  }
  const table = data?.table ?? [];
  return ACTIVITY_FAMILIES.filter((fam) => table.some(fam.match)).slice(0, 6);
};

export const buildSmartTablePlan = (
  f: ExecutiveFilterSnapshot,
  slices: HistoricalYearSlice[],
  mode: ComparisonTableMode = "historical"
): SmartTablePlan => {
  const years = normalizeHistoricalYears(slices.map((s) => s.year));
  const families = detectFamiliesFromFilter(f, slices);

  const girlsOnly = f.genders.includes("female") || f.gender === "female";
  const boysOnly = f.genders.includes("male") || f.gender === "male";

  return {
    families: families.length > 0 ? families : ACTIVITY_FAMILIES.slice(0, 4),
    years,
    mode,
    includeMatrix: mode !== "executive",
    sectionTitleAr: girlsOnly ? "قسم البنات" : boysOnly ? "قسم البنين" : "قسم البنين والبنات",
    sectionTitleEn: girlsOnly ? "Girls section" : boysOnly ? "Boys section" : "Boys and girls section",
  };
};

export const buildSmartHistoricalBundle = (
  f: ExecutiveFilterSnapshot,
  slices: HistoricalYearSlice[],
  mode: ComparisonTableMode = "historical",
  displayMode: HistoricalTableDisplayMode = "executive"
): {
  plan: SmartTablePlan;
  tables: HistoricalComparisonTableModel[];
  matrix: MatrixTableModel | null;
  matrixMeta: MatrixDebugMeta;
  resolution: HistoricalResolutionMeta;
  tablesFallback: HistoricalFallbackResult<HistoricalComparisonTableModel[]>;
} => {
  const plan = buildSmartTablePlan(f, slices, mode);
  const resolved = resolveHistoricalIntelligenceBundle(f, slices, {
    families: plan.families,
    sectionTitleAr: plan.sectionTitleAr,
    sectionTitleEn: plan.sectionTitleEn,
    includeMatrix: plan.includeMatrix,
    displayMode,
  });
  return {
    plan,
    tables: resolved.tables,
    matrix: resolved.matrix.model,
    matrixMeta: resolved.matrix.meta,
    resolution: resolved.meta,
    tablesFallback: resolved.tablesFallback,
  };
};
