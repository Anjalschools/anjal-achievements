/**
 * Executive summary strip for historical competition results.
 */

import type { HistoricalComparisonTableModel } from "@/lib/analytics/historical-comparison-table-engine";
import { columnKey } from "@/lib/analytics/historical-comparison-table-engine";
import type { HistoricalYearSlice } from "@/lib/analytics/historical-comparison-fetch";
import { normalizeDecimal, ratioToPercentage } from "@/lib/analytics/analytics-number-formatting";
import { buildHistoricalOutcomeIntelligence } from "@/lib/analytics/historical-outcome-intelligence";

export type CompetitionResultsSummary = {
  peakParticipationYear: number | null;
  peakAwardYear: number | null;
  globalPeakYear: number | null;
  globalDeclineYear: number | null;
  bestActivityAr: string;
  bestActivityEn: string;
  bestAwardRateActivityAr: string;
  bestAwardRateActivityEn: string;
  highestAwardRate: number | null;
  fastestGrowthLabelAr: string;
  fastestGrowthLabelEn: string;
  bestQualificationRate: number | null;
  mostStableActivityAr: string;
  mostStableActivityEn: string;
  globalConfidence: number;
};

export const buildCompetitionResultsSummary = (
  slices: HistoricalYearSlice[],
  tables: HistoricalComparisonTableModel[]
): CompetitionResultsSummary => {
  const empty: CompetitionResultsSummary = {
    peakParticipationYear: null,
    peakAwardYear: null,
    globalPeakYear: null,
    globalDeclineYear: null,
    bestActivityAr: "—",
    bestActivityEn: "—",
    bestAwardRateActivityAr: "—",
    bestAwardRateActivityEn: "—",
    highestAwardRate: null,
    fastestGrowthLabelAr: "—",
    fastestGrowthLabelEn: "—",
    bestQualificationRate: null,
    mostStableActivityAr: "—",
    mostStableActivityEn: "—",
    globalConfidence: 0,
  };

  if (tables.length === 0 && slices.length === 0) return empty;

  let peakPartYear: number | null = null;
  let peakPart = 0;
  let globalPeakYear: number | null = null;
  let globalDeclineYear: number | null = null;
  let minPart = Infinity;

  for (const s of slices) {
    const p = s.payload.kpis.totalParticipations ?? 0;
    if (p > peakPart) {
      peakPart = p;
      peakPartYear = s.year;
    }
    if (p < minPart) {
      minPart = p;
      globalDeclineYear = s.year;
    }
    if (p >= peakPart) globalPeakYear = s.year;
  }

  let peakAwardYear: number | null = null;
  let peakAward = 0;
  let bestTable = tables[0];
  let bestGrand = 0;
  let bestQualRate: number | null = null;
  let highestAwardRate: number | null = null;
  let bestAwardTable = tables[0];

  for (const table of tables) {
    if (table.totals.grandTotal > bestGrand) {
      bestGrand = table.totals.grandTotal;
      bestTable = table;
    }
    for (const yg of table.yearGroups) {
      const gold = table.totals.columnTotals[columnKey(yg.year, "gold")] ?? 0;
      const silver = table.totals.columnTotals[columnKey(yg.year, "silver")] ?? 0;
      const bronze = table.totals.columnTotals[columnKey(yg.year, "bronze")] ?? 0;
      const medals = gold + silver + bronze;
      if (medals > peakAward) {
        peakAward = medals;
        peakAwardYear = yg.year;
      }
      const qual = table.totals.columnTotals[columnKey(yg.year, "qualification_rate")] ?? 0;
      if (qual > (bestQualRate ?? 0)) bestQualRate = qual;
      const ar = table.totals.columnTotals[columnKey(yg.year, "award_rate")] ?? 0;
      if (ar > (highestAwardRate ?? 0)) {
        highestAwardRate = ar;
        bestAwardTable = table;
      }
    }
  }

  const leader = tables
    .flatMap((t) => t.trends)
    .sort((a, b) => b.deltaPct - a.deltaPct)[0];

  const outcomes = tables.map((t) => buildHistoricalOutcomeIntelligence(slices, t));
  const mostStable = outcomes.sort((a, b) => b.progressionQuality - a.progressionQuality)[0];

  const globalConfidence = normalizeDecimal(
    outcomes.length > 0
      ? outcomes.reduce((s, o) => s + o.confidence, 0) / outcomes.length
      : slices.length * 15,
    0
  );

  return {
    peakParticipationYear: peakPartYear,
    peakAwardYear,
    globalPeakYear,
    globalDeclineYear: minPart < Infinity ? globalDeclineYear : null,
    bestActivityAr: bestTable?.activityLabelAr ?? "—",
    bestActivityEn: bestTable?.activityLabelEn ?? "—",
    bestAwardRateActivityAr: bestAwardTable?.activityLabelAr ?? "—",
    bestAwardRateActivityEn: bestAwardTable?.activityLabelEn ?? "—",
    highestAwardRate,
    fastestGrowthLabelAr: leader
      ? `${leader.labelAr} (${normalizeDecimal(leader.deltaPct, 1)}%)`
      : "—",
    fastestGrowthLabelEn: leader
      ? `${leader.labelEn} (${normalizeDecimal(leader.deltaPct, 1)}%)`
      : "—",
    bestQualificationRate: bestQualRate,
    mostStableActivityAr: mostStable?.labelAr ?? bestTable?.activityLabelAr ?? "—",
    mostStableActivityEn: mostStable?.labelEn ?? bestTable?.activityLabelEn ?? "—",
    globalConfidence,
  };
};
