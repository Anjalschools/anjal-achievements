/**
 * Historical outcome intelligence — quality & competitive strength (not activity-only).
 */

import type { HistoricalComparisonTableModel } from "@/lib/analytics/historical-comparison-table-engine";
import { columnKey } from "@/lib/analytics/historical-comparison-table-engine";
import type { HistoricalYearSlice } from "@/lib/analytics/historical-comparison-fetch";
import { normalizeDecimal, ratioToPercentage } from "@/lib/analytics/analytics-number-formatting";

export type HistoricalOutcomeScore = {
  activityKey: string;
  labelAr: string;
  labelEn: string;
  participationQuality: number;
  awardQuality: number;
  efficiency: number;
  competitiveStrength: number;
  awardDensity: number;
  progressionQuality: number;
  overall: number;
  confidence: number;
};

export const buildHistoricalOutcomeIntelligence = (
  slices: HistoricalYearSlice[],
  table: HistoricalComparisonTableModel
): HistoricalOutcomeScore => {
  const rows = table.rows.filter((r) => !r.isTotal);
  let participation = 0;
  let qualified = 0;
  let awards = 0;

  for (const yg of table.yearGroups) {
    for (const row of rows) {
      participation += row.cells[columnKey(yg.year, "participation")] ?? 0;
      qualified += row.cells[columnKey(yg.year, "nomination")] ?? 0;
      awards +=
        (row.cells[columnKey(yg.year, "gold")] ?? 0) +
        (row.cells[columnKey(yg.year, "silver")] ?? 0) +
        (row.cells[columnKey(yg.year, "bronze")] ?? 0) +
        (row.cells[columnKey(yg.year, "award_winners")] ?? 0);
    }
  }

  const slicePart = slices.reduce((s, x) => s + (x.payload.kpis.totalParticipations ?? 0), 0);
  const participationQuality = normalizeDecimal(
    Math.min(100, (participation / Math.max(1, slicePart)) * 50 + (slices.length >= 3 ? 20 : 10)),
    0
  );
  const awardDensity = ratioToPercentage(awards, Math.max(1, participation));
  const efficiency = ratioToPercentage(qualified, Math.max(1, participation));
  const awardQuality = normalizeDecimal(Math.min(100, awardDensity * 1.2), 0);

  const years = table.yearGroups.map((g) => g.year).sort((a, b) => a - b);
  let progressionQuality = 50;
  if (years.length >= 2) {
    const first = rows.reduce(
      (s, r) => s + (r.cells[columnKey(years[0]!, "participation")] ?? 0),
      0
    );
    const last = rows.reduce(
      (s, r) => s + (r.cells[columnKey(years[years.length - 1]!, "participation")] ?? 0),
      0
    );
    const delta = first > 0 ? ((last - first) / first) * 100 : 0;
    progressionQuality = normalizeDecimal(50 + Math.max(-30, Math.min(30, delta)), 0);
  }

  const competitiveStrength = normalizeDecimal(
    awardQuality * 0.35 + efficiency * 0.25 + participationQuality * 0.2 + progressionQuality * 0.2,
    0
  );

  const overall = competitiveStrength;
  const confidence = normalizeDecimal(
    Math.min(100, slices.length * 18 + (participation > 0 ? 25 : 0) + (awards > 0 ? 20 : 0)),
    0
  );

  return {
    activityKey: table.activityFamilyKey,
    labelAr: table.activityLabelAr,
    labelEn: table.activityLabelEn,
    participationQuality,
    awardQuality,
    efficiency,
    competitiveStrength,
    awardDensity,
    progressionQuality,
    overall,
    confidence,
  };
};
