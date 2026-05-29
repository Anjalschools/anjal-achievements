/**
 * Historical educational comparison tables — multi-year grouped headers from participation payloads.
 */

import type { ParticipationActivityRow } from "@/lib/achievement-participation-analytics";
import type { HistoricalYearSlice } from "@/lib/analytics/historical-comparison-fetch";
import { buildSafeMatrixModel } from "@/lib/analytics/historical-matrix-model";
import type { TableTotalsBundle } from "@/lib/analytics/analytics-table-total-contract";
import {
  appendRealTotalsRow,
  buildRealHistoricalTotals,
} from "@/lib/analytics/analytics-real-total-engine";
import {
  dedupeActivityTotalRow,
  orderHistoricalRows,
} from "@/lib/analytics/historical-table-row-semantics";
import { normalizeDecimal } from "@/lib/analytics/analytics-number-formatting";
import { getSmartResultsMetrics } from "@/lib/analytics/historical-smart-results-table";
import { polishHistoricalTableModel } from "@/lib/analytics/historical-table-polish";
import type { HistoricalTableDisplayMode } from "@/lib/analytics/historical-executive-table-theme";
import type { AnalyticsTableThemeId } from "@/lib/analytics/analytics-table-theme-registry";
import { ALL_HISTORICAL_ACTIVITY_FAMILIES } from "@/lib/analytics/historical-activity-resolution";
import {
  attachOutcomeMetadata,
  resolveHistoricalTablePayload,
} from "@/lib/analytics/historical-results-resolution-engine";
import { buildCompetitionHistoricalNarratives } from "@/lib/analytics/historical-competition-intelligence";
import type { HistoricalOutcomeGap } from "@/lib/analytics/historical-results-resolution-engine";
import type { UnifiedAggregationGraph } from "@/lib/analytics/historical-unified-aggregation-graph";
import { logHistoricalResultsDebug } from "@/lib/analytics/historical-results-debugger";
import { normalizeAcademicYearLabel } from "@/lib/analytics/competition-year-normalizer";
import {
  ROW_CATEGORIES,
  type HistoricalRowCategory,
} from "@/lib/analytics/shared/historical-row-categories";
import { rowMatchesCategory } from "@/lib/analytics/shared/historical-row-matcher";
import type { MatrixTableModel } from "@/lib/analytics/shared/historical-matrix-types";

export type ComparisonTableMode =
  | "executive"
  | "detailed"
  | "historical"
  | "trend"
  | "achievement"
  | "participation";

export type HistoricalTableType =
  | "qualification_acceptance"
  | "medals"
  | "talent_discovery"
  | "training_program"
  | "standardized_testing"
  | "matrix";

export type TrendDirection = "up" | "down" | "stable";

export type HistoricalMetricColumn = {
  key: string;
  labelAr: string;
  labelEn: string;
  resultToken?: string;
};

export type HistoricalYearColumnGroup = {
  year: number;
  labelAr: string;
  labelEn: string;
  metrics: HistoricalMetricColumn[];
};

export type HistoricalTableCell = {
  rowKey: string;
  year: number;
  metricKey: string;
  value: number;
  columnKey: string;
};

export type HistoricalTrendChip = {
  id: string;
  labelAr: string;
  labelEn: string;
  direction: TrendDirection;
  metricKey: string;
  yearFrom: number;
  yearTo: number;
  deltaPct: number;
};

export type HistoricalTableNarrative = {
  id: string;
  bodyAr: string;
  bodyEn: string;
  priority: number;
};

export type HistoricalComparisonTableModel = {
  id: string;
  tableType: HistoricalTableType;
  themeId: AnalyticsTableThemeId;
  mode: ComparisonTableMode;
  sectionTitleAr: string;
  sectionTitleEn: string;
  activityFamilyKey: string;
  activityLabelAr: string;
  activityLabelEn: string;
  yearGroups: HistoricalYearColumnGroup[];
  rowCategories: HistoricalRowCategory[];
  rows: Array<{
    key: string;
    labelAr: string;
    labelEn: string;
    cells: Record<string, number>;
    isTotal?: boolean;
  }>;
  totals: TableTotalsBundle;
  trends: HistoricalTrendChip[];
  narratives: HistoricalTableNarrative[];
  outcomeGap?: HistoricalOutcomeGap;
  /** Injected unified outcome graph — drives column visibility & export */
  unifiedGraph?: UnifiedAggregationGraph;
};

const SCOPE_LABELS: Record<string, { ar: string; en: string }> = {
  school: { ar: "مدرسة", en: "School" },
  province: { ar: "منطقة", en: "Province" },
  kingdom: { ar: "مملكة", en: "Kingdom" },
  international: { ar: "دولي", en: "International" },
  global: { ar: "عالمي", en: "Global" },
};

const SCOPE_ROW_CATEGORIES: HistoricalRowCategory[] = (
  ["school", "province", "kingdom", "international", "global"] as const
).flatMap((scope) => [
  {
    key: `scope_${scope}_ar`,
    labelAr: `${SCOPE_LABELS[scope]!.ar} — عربي`,
    labelEn: `${SCOPE_LABELS[scope]!.en} — Arabic`,
    stage: "all" as const,
    section: "arabic" as const,
  },
  {
    key: `scope_${scope}_intl`,
    labelAr: `${SCOPE_LABELS[scope]!.ar} — دولي`,
    labelEn: `${SCOPE_LABELS[scope]!.en} — International`,
    stage: "all" as const,
    section: "international" as const,
  },
]);

/** Grade + achievement-scope + activity aggregate rows */
export const HISTORICAL_ROW_CATEGORIES: HistoricalRowCategory[] = [
  ...ROW_CATEGORIES,
  ...SCOPE_ROW_CATEGORIES,
  {
    key: "activity_total",
    labelAr: "إجمالي النشاط",
    labelEn: "Activity total",
    stage: "all",
    section: "all",
  },
];

export type ActivityFamilyDef = {
  key: string;
  labelAr: string;
  labelEn: string;
  tableType: HistoricalTableType;
  themeId: AnalyticsTableThemeId;
  match: (row: ParticipationActivityRow) => boolean;
};

/** @deprecated import path preserved — matchers use taxonomy + typeKey */
export const ACTIVITY_FAMILIES: ActivityFamilyDef[] = ALL_HISTORICAL_ACTIVITY_FAMILIES;

/** @deprecated Use getSmartResultsMetrics */
export const METRIC_SETS: Record<HistoricalTableType, HistoricalMetricColumn[]> = {
  qualification_acceptance: [],
  medals: [],
  talent_discovery: [],
  training_program: [],
  standardized_testing: [],
  matrix: [],
};

export const resolveMetricColumns = (tableType: HistoricalTableType): HistoricalMetricColumn[] =>
  tableType === "matrix" ? [] : getSmartResultsMetrics(tableType);

export const columnKey = (year: number, metricKey: string): string => `${year}__${metricKey}`;


export const buildYearColumnGroups = (
  years: number[],
  tableType: HistoricalTableType,
  activityLabelAr: string,
  activityLabelEn: string
): HistoricalYearColumnGroup[] => {
  const metrics = getSmartResultsMetrics(tableType);

  return years.map((startYear) => {
    const labels = normalizeAcademicYearLabel(startYear, {
      titleAr: activityLabelAr,
      titleEn: activityLabelEn,
    });
    return {
      year: startYear,
      labelAr: labels.labelAr,
      labelEn: labels.labelEn,
      metrics,
    };
  });
};

export const buildHistoricalComparisonTable = (input: {
  family: ActivityFamilyDef;
  slices: HistoricalYearSlice[];
  mode?: ComparisonTableMode;
  sectionTitleAr?: string;
  sectionTitleEn?: string;
  displayMode?: HistoricalTableDisplayMode;
}): HistoricalComparisonTableModel | null => {
  const years = input.slices.map((s) => s.year);
  if (years.length === 0) return null;

  const yearGroups = buildYearColumnGroups(
    years,
    input.family.tableType,
    input.family.labelAr,
    input.family.labelEn
  );

  const resolved = resolveHistoricalTablePayload({
    familyKey: input.family.key,
    slices: input.slices,
    yearGroups,
    rowCategories: HISTORICAL_ROW_CATEGORIES,
    rowMatchesCategory,
    tableType: input.family.tableType,
  });

  if (!resolved) return null;

  const { dataRows, outcomeGap } = resolved;
  const semanticRows = orderHistoricalRows(dedupeActivityTotalRow(dataRows));
  const rows = appendRealTotalsRow(semanticRows, "المجموع", "Total");
  const totals = buildRealHistoricalTotals(semanticRows);

  const trends = buildHistoricalTrends(yearGroups, dataRows);
  const outcomeNarratives = buildCompetitionHistoricalNarratives(
    input.family,
    input.slices,
    outcomeGap
  );
  const narratives = [
    ...outcomeNarratives,
    ...buildHistoricalNarratives(input.family, yearGroups, dataRows, trends),
  ]
    .sort((a, b) => b.priority - a.priority)
    .filter((n, i, arr) => arr.findIndex((x) => x.id === n.id) === i);

  const raw: HistoricalComparisonTableModel = {
    id: `hist-${input.family.key}-${years.join("-")}`,
    tableType: input.family.tableType,
    themeId: input.family.themeId,
    mode: input.mode ?? "historical",
    sectionTitleAr: input.sectionTitleAr ?? "قسم البنين والبنات",
    sectionTitleEn: input.sectionTitleEn ?? "Boys and girls section",
    activityFamilyKey: input.family.key,
    activityLabelAr: input.family.labelAr,
    activityLabelEn: input.family.labelEn,
    yearGroups,
    rowCategories: HISTORICAL_ROW_CATEGORIES,
    rows,
    totals,
    trends,
    narratives,
    outcomeGap,
    unifiedGraph: resolved.unifiedGraph,
  };

  const polished = polishHistoricalTableModel(raw, input.displayMode ?? "executive");
  const withMeta = attachOutcomeMetadata(polished, outcomeGap);
  logHistoricalResultsDebug(resolved.unifiedGraph, withMeta);
  return withMeta;
};

const countYearsWithParticipation = (
  yearGroups: HistoricalYearColumnGroup[],
  dataRows: Array<{ key: string; cells: Record<string, number> }>
): number => {
  const primaryMetric = yearGroups[0]?.metrics[0]?.key ?? "participation";
  const yearsWithData = new Set<number>();
  for (const yg of yearGroups) {
    const sum = dataRows.reduce(
      (s, r) => s + (r.cells[columnKey(yg.year, primaryMetric)] ?? 0),
      0
    );
    if (sum > 0) yearsWithData.add(yg.year);
  }
  return yearsWithData.size;
};

export const buildHistoricalTrends = (
  yearGroups: HistoricalYearColumnGroup[],
  dataRows: Array<{ key: string; cells: Record<string, number> }>
): HistoricalTrendChip[] => {
  const chips: HistoricalTrendChip[] = [];
  if (yearGroups.length < 2 || countYearsWithParticipation(yearGroups, dataRows) < 2) {
    return chips;
  }

  const years = yearGroups.map((g) => g.year);
  const first = years[0]!;
  const last = years[years.length - 1]!;
  const primaryMetric = yearGroups[0]!.metrics[0]?.key ?? "participation";

  let maxGrowth = -Infinity;
  let maxGrowthRow = "";
  for (const row of dataRows) {
    const a = row.cells[columnKey(first, primaryMetric)] ?? 0;
    const b = row.cells[columnKey(last, primaryMetric)] ?? 0;
    const growth = b - a;
    if (growth > maxGrowth) {
      maxGrowth = growth;
      maxGrowthRow = row.key;
    }
  }

  const totalFirst = dataRows.reduce((s, r) => s + (r.cells[columnKey(first, primaryMetric)] ?? 0), 0);
  const totalLast = dataRows.reduce((s, r) => s + (r.cells[columnKey(last, primaryMetric)] ?? 0), 0);
  const deltaPct =
    totalFirst > 0 ? normalizeDecimal(((totalLast - totalFirst) / totalFirst) * 100, 1) : 0;

  chips.push({
    id: "overall_trend",
    labelAr:
      deltaPct > 5 ? "↑ نمو إجمالي" : deltaPct < -5 ? "↓ انخفاض إجمالي" : "استقرار",
    labelEn: deltaPct > 5 ? "↑ Overall growth" : deltaPct < -5 ? "↓ Overall decline" : "Stable",
    direction: deltaPct > 5 ? "up" : deltaPct < -5 ? "down" : "stable",
    metricKey: primaryMetric,
    yearFrom: first,
    yearTo: last,
    deltaPct,
  });

  if (maxGrowthRow) {
    const cat = ROW_CATEGORIES.find((c) => c.key === maxGrowthRow);
    chips.push({
      id: "fastest_growth_row",
      labelAr: `أسرع نمو: ${cat?.labelAr ?? maxGrowthRow}`,
      labelEn: `Fastest growth: ${cat?.labelEn ?? maxGrowthRow}`,
      direction: "up",
      metricKey: primaryMetric,
      yearFrom: first,
      yearTo: last,
      deltaPct: maxGrowth,
    });
  }

  const bestYear = years.reduce((best, y) => {
    const sum = dataRows.reduce((s, r) => s + (r.cells[columnKey(y, "gold")] ?? r.cells[columnKey(y, primaryMetric)] ?? 0), 0);
    const bestSum = dataRows.reduce(
      (s, r) => s + (r.cells[columnKey(best, "gold")] ?? r.cells[columnKey(best, primaryMetric)] ?? 0),
      0
    );
    return sum > bestSum ? y : best;
  }, first);

  chips.push({
    id: "peak_year",
    labelAr: `أعلى سنة: ${bestYear}`,
    labelEn: `Peak year: ${bestYear}`,
    direction: "up",
    metricKey: "gold",
    yearFrom: bestYear,
    yearTo: bestYear,
    deltaPct: 0,
  });

  return chips;
};

export const buildHistoricalNarratives = (
  family: ActivityFamilyDef,
  yearGroups: HistoricalYearColumnGroup[],
  dataRows: Array<{ key: string; cells: Record<string, number> }>,
  trends: HistoricalTrendChip[]
): HistoricalTableNarrative[] => {
  const narratives: HistoricalTableNarrative[] = [];
  if (yearGroups.length === 0) return narratives;

  const lastYear = yearGroups[yearGroups.length - 1]!.year;
  const goldKey = columnKey(lastYear, "gold");
  const partKey = columnKey(lastYear, "participation");
  const nomKey = columnKey(lastYear, "nomination");

  let topRow: (typeof dataRows)[0] | undefined = dataRows[0];
  let topVal = 0;
  for (const row of dataRows) {
    const v = row.cells[goldKey] ?? row.cells[partKey] ?? 0;
    if (v > topVal) {
      topVal = v;
      topRow = row;
    }
  }

  const topCat = topRow ? ROW_CATEGORIES.find((c) => c.key === topRow!.key) : undefined;
  if (topRow && topVal > 0 && topCat) {
    narratives.push({
      id: "top_row_last_year",
      priority: 80,
      bodyAr: `${family.labelAr}: ${topCat.labelAr} يقود المؤشرات في ${lastYear}.`,
      bodyEn: `${family.labelEn}: ${topCat.labelEn} leads indicators in ${lastYear}.`,
    });
  }

  const overall = trends.find((t) => t.id === "overall_trend");
  if (overall && Math.abs(overall.deltaPct) >= 10) {
    narratives.push({
      id: "overall_change",
      priority: 75,
      bodyAr: `${family.labelAr} — ${overall.labelAr} بنسبة ${overall.deltaPct}% بين ${overall.yearFrom} و${overall.yearTo}.`,
      bodyEn: `${family.labelEn} — ${overall.labelEn} by ${overall.deltaPct}% between ${overall.yearFrom} and ${overall.yearTo}.`,
    });
  }

  if (family.tableType === "qualification_acceptance") {
    const nomTotal = dataRows.reduce((s, r) => s + (r.cells[nomKey] ?? 0), 0);
    if (nomTotal > 0) {
      narratives.push({
        id: "nomination_focus",
        priority: 70,
        bodyAr: `إجمالي الترشيحات لـ ${family.labelAr}: ${nomTotal} في آخر سنة ضمن النطاق.`,
        bodyEn: `Total nominations for ${family.labelEn}: ${nomTotal} in the latest scoped year.`,
      });
    }
  }

  return narratives.sort((a, b) => b.priority - a.priority);
};

export const buildEducationalMatrixTable = (
  slices: HistoricalYearSlice[],
  _rowDimension: "stage" | "level" = "stage"
): MatrixTableModel | null => {
  return buildSafeMatrixModel(slices).model;
};

export const buildAllHistoricalTables = (
  slices: HistoricalYearSlice[],
  families: ActivityFamilyDef[] = ACTIVITY_FAMILIES,
  sectionTitleAr = "قسم البنين والبنات",
  sectionTitleEn = "Boys and girls section"
): HistoricalComparisonTableModel[] => {
  const tables: HistoricalComparisonTableModel[] = [];
  for (const family of families) {
    const hasData = slices.some((s) => s.payload.table.some(family.match));
    if (!hasData) continue;
    const model = buildHistoricalComparisonTable({
      family,
      slices,
      sectionTitleAr,
      sectionTitleEn,
    });
    if (model) tables.push(model);
  }
  return tables.sort((a, b) => b.totals.grandTotal - a.totals.grandTotal);
};
