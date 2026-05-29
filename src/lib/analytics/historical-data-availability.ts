/**
 * Historical data availability — sparsity & compatible measures before building UI.
 */

import type { HistoricalYearSlice } from "@/lib/analytics/historical-comparison-fetch";
import { ACTIVITY_FAMILIES } from "@/lib/analytics/historical-comparison-table-engine";
import { extractMetric } from "@/lib/analytics/shared/historical-metric-extract";
import { matchActivityEvolution } from "@/lib/analytics/historical-compatibility-registry";

export type HistoricalAvailabilityReport = {
  availableYears: number[];
  availableYearsByMetric: Record<string, number[]>;
  availableDimensionsByYear: Record<number, string[]>;
  compatibleHistoricalMeasures: string[];
  sparseYearWarnings: Array<{ year: number; messageAr: string; messageEn: string }>;
  sparsityRatio: number;
  hasPartialSignal: boolean;
  validYearCount: number;
};

const METRICS_TO_PROBE = ["participation", "gold", "nomination", "acceptance"] as const;

export const assessHistoricalDataAvailability = (
  slices: HistoricalYearSlice[]
): HistoricalAvailabilityReport => {
  const availableYears: number[] = [];
  const availableYearsByMetric: Record<string, number[]> = {
    participation: [],
    gold: [],
    nomination: [],
    acceptance: [],
  };
  const availableDimensionsByYear: Record<number, string[]> = {};
  const sparseYearWarnings: HistoricalAvailabilityReport["sparseYearWarnings"] = [];

  for (const slice of slices) {
    const part = slice.payload.kpis.totalParticipations;
    const tableLen = slice.payload.table.length;
    const dims = new Set<string>();

    if (part > 0 || tableLen > 0) {
      availableYears.push(slice.year);
    }

    for (const m of METRICS_TO_PROBE) {
      const rows = slice.payload.table;
      const val =
        m === "participation"
          ? part
          : extractMetric(rows, m);
      if (val > 0) availableYearsByMetric[m]!.push(slice.year);
    }

    for (const fam of ACTIVITY_FAMILIES) {
      if (slice.payload.table.some((r) => fam.match(r) || matchActivityEvolution(r.activityLabelAr, r.activityLabelEn, fam.key))) {
        dims.add(fam.key);
      }
    }
    availableDimensionsByYear[slice.year] = [...dims];

    if (part > 0 && part < 5 && tableLen < 3) {
      sparseYearWarnings.push({
        year: slice.year,
        messageAr: `بيانات متفرقة في ${slice.year}`,
        messageEn: `Sparse data in ${slice.year}`,
      });
    }
  }

  const sparsityRatio =
    slices.length > 0
      ? sparseYearWarnings.length / slices.length
      : 1;

  const hasPartialSignal = availableYears.length > 0 || slices.some((s) => s.payload.table.length > 0);

  if (process.env.NODE_ENV !== "production" && hasPartialSignal) {
    // eslint-disable-next-line no-console
    console.info("[historical-compatibility]", {
      years: availableYears,
      measures: Object.keys(availableYearsByMetric).filter((k) => (availableYearsByMetric[k]?.length ?? 0) > 0),
      sparsityRatio,
    });
  }

  return {
    availableYears: [...new Set(availableYears)].sort((a, b) => a - b),
    availableYearsByMetric,
    availableDimensionsByYear,
    compatibleHistoricalMeasures: METRICS_TO_PROBE.filter(
      (m) => (availableYearsByMetric[m]?.length ?? 0) > 0
    ),
    sparseYearWarnings,
    sparsityRatio,
    hasPartialSignal,
    validYearCount: availableYears.length,
  };
};
