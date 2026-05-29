/**
 * Injects unified outcome measures into historical year slices before table build.
 */

import type { HistoricalYearSlice } from "@/lib/analytics/historical-comparison-fetch";
import type { HistoricalTableType } from "@/lib/analytics/historical-comparison-table-engine";
import {
  buildUnifiedAggregationGraph,
  buildYearOutcomeMeasures,
  type HistoricalOutcomeMeasures,
  type UnifiedAggregationGraph,
} from "@/lib/analytics/historical-unified-aggregation-graph";

export type InjectedHistoricalYearSlice = HistoricalYearSlice & {
  /** Client-side only — not part of API contract */
  injectedMeasures: HistoricalOutcomeMeasures;
};

export type InjectedHistoricalBundle = {
  slices: InjectedHistoricalYearSlice[];
  unifiedGraph: UnifiedAggregationGraph;
};

export const injectOutcomeMeasuresIntoSlices = (
  slices: HistoricalYearSlice[],
  familyKey: string,
  tableType: HistoricalTableType
): InjectedHistoricalBundle => {
  const unifiedGraph = buildUnifiedAggregationGraph(slices, familyKey, tableType);
  const injected: InjectedHistoricalYearSlice[] = slices.map((slice) => ({
    ...slice,
    injectedMeasures:
      unifiedGraph.byYear[slice.year] ??
      buildYearOutcomeMeasures(slice, familyKey).measures,
  }));
  return { slices: injected, unifiedGraph };
};
