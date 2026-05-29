/**
 * Builds historical table row cells from injected outcome measures (not participation-only).
 */

import type { HistoricalYearColumnGroup } from "@/lib/analytics/historical-comparison-table-engine";
import { columnKey } from "@/lib/analytics/historical-comparison-table-engine";
import type { ParticipationActivityRow } from "@/lib/achievement-participation-analytics";
import type { HistoricalYearSlice } from "@/lib/analytics/historical-comparison-fetch";
import { resolveFamilyRowsForYear } from "@/lib/analytics/historical-activity-resolution";
import type { InjectedHistoricalYearSlice } from "@/lib/analytics/historical-outcome-measure-injector";
import {
  measureValueForMetric,
  type HistoricalOutcomeMeasures,
  type UnifiedAggregationGraph,
} from "@/lib/analytics/historical-unified-aggregation-graph";
import { isRateMetric } from "@/lib/analytics/historical-results-metric-semantics";
import { buildYearOutcomeMeasures } from "@/lib/analytics/historical-unified-aggregation-graph";
import { resolveMetricFromRows } from "@/lib/analytics/historical-results-resolution-engine";
import {
  dedupeActivityTotalRow,
  orderHistoricalRows,
  shouldShowActivityTotalRow,
} from "@/lib/analytics/historical-table-row-semantics";

export const buildCellsFromOutcomeMeasures = (
  slices: InjectedHistoricalYearSlice[],
  yearGroups: HistoricalYearColumnGroup[]
): Record<string, number> => {
  const cells: Record<string, number> = {};
  for (const slice of slices) {
    const measures = slice.injectedMeasures;
    for (const group of yearGroups) {
      if (group.year !== slice.year) continue;
      for (const metric of group.metrics) {
        const ck = columnKey(slice.year, metric.key);
        if (isRateMetric(metric.key)) {
          const rate = measureValueForMetric(measures, metric.key);
          if (rate > 0) cells[ck] = rate;
          continue;
        }
        const v = measureValueForMetric(measures, metric.key);
        if (v > 0) cells[ck] = v;
      }
    }
  }
  return cells;
};

export const buildCategoryCellsFromRows = (
  slices: HistoricalYearSlice[],
  familyKey: string,
  yearGroups: HistoricalYearColumnGroup[],
  categoryMatcher: (row: ParticipationActivityRow) => boolean
): Record<string, number> => {
  const cells: Record<string, number> = {};
  for (const slice of slices) {
    const rows = resolveFamilyRowsForYear(slice, familyKey).filter(categoryMatcher);
    for (const group of yearGroups) {
      if (group.year !== slice.year) continue;
      for (const metric of group.metrics) {
        const ck = columnKey(slice.year, metric.key);
        if (isRateMetric(metric.key)) {
          const { measures } = buildYearOutcomeMeasures(
            { year: slice.year, payload: { ...slice.payload, table: rows } },
            familyKey
          );
          const rate = measureValueForMetric(measures, metric.key);
          if (rate > 0) cells[ck] = rate;
          continue;
        }
        const v = resolveMetricFromRows(rows, metric.key);
        if (v > 0) cells[ck] = v;
      }
    }
  }
  return cells;
};

export const buildActivityTotalRowFromInjection = (
  bundle: { slices: InjectedHistoricalYearSlice[]; unifiedGraph: UnifiedAggregationGraph },
  yearGroups: HistoricalYearColumnGroup[]
): {
  key: string;
  labelAr: string;
  labelEn: string;
  cells: Record<string, number>;
} | null => {
  const cells = buildCellsFromOutcomeMeasures(bundle.slices, yearGroups);
  if (!Object.values(cells).some((v) => v > 0)) return null;
  return {
    key: "activity_total",
    labelAr: "إجمالي النشاط",
    labelEn: "Activity total",
    cells,
  };
};

export const buildHistoricalOutcomeRows = (input: {
  bundle: { slices: InjectedHistoricalYearSlice[]; unifiedGraph: UnifiedAggregationGraph };
  yearGroups: HistoricalYearColumnGroup[];
  familyKey: string;
  rowCategories: Array<{ key: string; labelAr: string; labelEn: string }>;
  rowMatchesCategory: (row: ParticipationActivityRow, cat: { key: string }) => boolean;
}): Array<{ key: string; labelAr: string; labelEn: string; cells: Record<string, number> }> => {
  const categoryRows = input.rowCategories
    .filter((c) => c.key !== "activity_total")
    .map((cat) => ({
      key: cat.key,
      labelAr: cat.labelAr,
      labelEn: cat.labelEn,
      cells: buildCategoryCellsFromRows(
        input.bundle.slices,
        input.familyKey,
        input.yearGroups,
        (row) => input.rowMatchesCategory(row, cat)
      ),
    }))
    .filter((r) => Object.values(r.cells).some((v) => v > 0));

  const scopeRows = categoryRows.filter((r) => r.key.startsWith("scope_"));
  const stageRows = categoryRows.filter((r) => !r.key.startsWith("scope_"));
  const totalRow = buildActivityTotalRowFromInjection(input.bundle, input.yearGroups);
  let rows = categoryRows;
  if (rows.length === 0 && totalRow) {
    rows = [totalRow];
  } else if (
    totalRow &&
    !rows.some((r) => r.key === "activity_total") &&
    shouldShowActivityTotalRow(stageRows.length, scopeRows.length)
  ) {
    rows = [...rows, totalRow];
  }
  return orderHistoricalRows(dedupeActivityTotalRow(rows));
};
