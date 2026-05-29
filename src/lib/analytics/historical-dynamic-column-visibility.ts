/**
 * Dynamic column visibility — hide all-zero metrics & tier ordering.
 */

import type {
  HistoricalComparisonTableModel,
  HistoricalMetricColumn,
  HistoricalTableType,
} from "@/lib/analytics/historical-comparison-table-engine";
import { columnKey } from "@/lib/analytics/historical-comparison-table-engine";
import type { HistoricalTableDisplayMode } from "@/lib/analytics/historical-executive-table-theme";
import { getSmartResultsMetrics } from "@/lib/analytics/historical-smart-results-table";
import { isRateMetric } from "@/lib/analytics/historical-results-metric-semantics";
import {
  graphHasMetricSignal,
  type UnifiedAggregationGraph,
} from "@/lib/analytics/historical-unified-aggregation-graph";

export type MetricTier = "primary" | "secondary" | "tertiary";

const METRIC_TIER: Record<string, MetricTier> = {
  participation: "primary",
  nomination: "primary",
  award_winners: "primary",
  award_rate: "primary",
  qualification_rate: "primary",
  medal_rate: "primary",
  completion_rate: "primary",
  excellence_rate: "primary",
  gold: "secondary",
  silver: "secondary",
  bronze: "secondary",
  rankings: "secondary",
  first_place: "secondary",
  finalists: "secondary",
  acceptance: "primary",
  pass: "primary",
  intensive: "primary",
  avg_performance: "primary",
  score_95: "primary",
  exceptional: "primary",
  gifted: "primary",
  promising: "primary",
  discovery_rate: "primary",
};

const TIER_ORDER: MetricTier[] = ["primary", "secondary", "tertiary"];

export const metricHasSignalInModel = (
  model: HistoricalComparisonTableModel,
  metricKey: string
): boolean => {
  if (isRateMetric(metricKey)) {
    return model.rows.some((row) =>
      model.yearGroups.some((yg) => {
        const v = row.cells[columnKey(yg.year, metricKey)];
        return typeof v === "number" && v > 0;
      })
    );
  }
  const total = model.rows
    .filter((r) => !r.isTotal)
    .reduce((sum, row) => {
      const rowSum = model.yearGroups.reduce(
        (s, yg) => s + (row.cells[columnKey(yg.year, metricKey)] ?? 0),
        0
      );
      return sum + rowSum;
    }, 0);
  return total > 0;
};

const sortByTier = (metrics: HistoricalMetricColumn[]): HistoricalMetricColumn[] =>
  [...metrics].sort((a, b) => {
    const ta = METRIC_TIER[a.key] ?? "tertiary";
    const tb = METRIC_TIER[b.key] ?? "tertiary";
    return TIER_ORDER.indexOf(ta) - TIER_ORDER.indexOf(tb);
  });

export const filterVisibleMetrics = (
  metrics: HistoricalMetricColumn[],
  model: HistoricalComparisonTableModel,
  displayMode: HistoricalTableDisplayMode,
  rawGraph?: UnifiedAggregationGraph | null
): HistoricalMetricColumn[] => {
  const withSignal = metrics.filter((m) => {
    if (rawGraph && graphHasMetricSignal(rawGraph, m.key)) return true;
    return metricHasSignalInModel(model, m.key);
  });
  const sorted = sortByTier(withSignal);

  if (displayMode === "analyst" || displayMode === "presentation") {
    return sorted;
  }

  const primary = sorted.filter((m) => (METRIC_TIER[m.key] ?? "tertiary") === "primary");
  const secondary = sorted.filter((m) => (METRIC_TIER[m.key] ?? "tertiary") === "secondary");
  return [...primary, ...secondary.slice(0, displayMode === "compact" ? 1 : 3)];
};

export const applyDynamicColumnVisibility = (
  model: HistoricalComparisonTableModel,
  displayMode: HistoricalTableDisplayMode = "executive",
  rawGraph?: UnifiedAggregationGraph | null
): HistoricalComparisonTableModel => {
  const catalog = getSmartResultsMetrics(model.tableType);
  const graph = rawGraph ?? model.unifiedGraph ?? null;
  const visibleKeys = new Set(
    filterVisibleMetrics(catalog, model, displayMode, graph).map((m) => m.key)
  );

  const yearGroups = model.yearGroups.map((yg) => ({
    ...yg,
    metrics: yg.metrics.filter((m) => visibleKeys.has(m.key)),
  }));

  const prunedRows = model.rows.map((row) => {
    const cells: Record<string, number> = {};
    for (const yg of yearGroups) {
      for (const m of yg.metrics) {
        const k = columnKey(yg.year, m.key);
        if (Object.prototype.hasOwnProperty.call(row.cells, k)) {
          cells[k] = row.cells[k] ?? 0;
        }
      }
    }
    return { ...row, cells };
  });

  return {
    ...model,
    yearGroups: yearGroups.filter((yg) => yg.metrics.length > 0),
    rows: prunedRows,
  };
};

export const countHiddenMetrics = (
  model: HistoricalComparisonTableModel,
  tableType: HistoricalTableType,
  displayMode: HistoricalTableDisplayMode
): number => {
  const all = getSmartResultsMetrics(tableType);
  const visible = filterVisibleMetrics(all, model, displayMode, model.unifiedGraph);
  return Math.max(0, all.length - visible.length);
};
