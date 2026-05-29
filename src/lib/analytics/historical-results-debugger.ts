/**
 * Dev-only historical results debugger — raw counts & hidden metric reasons.
 */

import type { UnifiedAggregationGraph } from "@/lib/analytics/historical-unified-aggregation-graph";
import { graphHasMetricSignal } from "@/lib/analytics/historical-unified-aggregation-graph";
import type { HistoricalComparisonTableModel } from "@/lib/analytics/historical-comparison-table-engine";
import { getSmartResultsMetrics } from "@/lib/analytics/historical-smart-results-table";
import { metricHasSignalInModel } from "@/lib/analytics/historical-dynamic-column-visibility";

export type HistoricalResultsDebugReport = {
  familyKey: string;
  totals: UnifiedAggregationGraph["totals"];
  signals: UnifiedAggregationGraph["signals"];
  provenance: UnifiedAggregationGraph["provenance"];
  hiddenMetrics: Array<{ key: string; reason: string }>;
  renderedZeros: string[];
};

export const buildHistoricalResultsDebugReport = (
  graph: UnifiedAggregationGraph,
  model: HistoricalComparisonTableModel
): HistoricalResultsDebugReport => {
  const catalog = getSmartResultsMetrics(model.tableType);
  const hiddenMetrics: Array<{ key: string; reason: string }> = [];

  for (const m of catalog) {
    const rawHas = graphHasMetricSignal(graph, m.key);
    const renderedHas = metricHasSignalInModel(model, m.key);
    if (rawHas && !renderedHas) {
      hiddenMetrics.push({
        key: m.key,
        reason: "raw graph has signal but rendered cells are zero",
      });
    }
  }

  const renderedZeros: string[] = [];
  for (const row of model.rows.filter((r) => !r.isTotal)) {
    for (const yg of model.yearGroups) {
      for (const m of yg.metrics) {
        const ck = `${yg.year}__${m.key}`;
        const v = row.cells[ck];
        if (v === 0) renderedZeros.push(`${row.key}/${ck}`);
      }
    }
  }

  return {
    familyKey: graph.familyKey,
    totals: graph.totals,
    signals: graph.signals,
    provenance: graph.provenance,
    hiddenMetrics,
    renderedZeros: renderedZeros.slice(0, 20),
  };
};

export const logHistoricalResultsDebug = (
  graph: UnifiedAggregationGraph,
  model: HistoricalComparisonTableModel
): void => {
  if (process.env.NODE_ENV === "production") return;
  if (process.env.HISTORICAL_DEBUG !== "1" && process.env.AI_DEBUG !== "1") return;
  const report = buildHistoricalResultsDebugReport(graph, model);
  // eslint-disable-next-line no-console
  console.info("[historical-results-debug]", report);
};
