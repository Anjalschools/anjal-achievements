/**
 * Shared metric extractor — dependency leaf.
 */

import type { ParticipationActivityRow } from "@/lib/achievement-participation-analytics";
import {
  computeHistoricalMetricValue,
  computeHistoricalRate,
  isRateMetric,
} from "@/lib/analytics/historical-results-metric-semantics";

export const extractMetric = (rows: ParticipationActivityRow[], metricKey: string): number => {
  if (isRateMetric(metricKey)) {
    const rate = computeHistoricalRate(
      rows,
      metricKey as Parameters<typeof computeHistoricalRate>[1]
    );
    return rate ?? 0;
  }
  return computeHistoricalMetricValue(
    rows,
    metricKey as Parameters<typeof computeHistoricalMetricValue>[1]
  );
};

