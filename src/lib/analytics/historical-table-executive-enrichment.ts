/**
 * Per-table executive enrichment — mini insights inside table cards.
 */

import type { HistoricalComparisonTableModel } from "@/lib/analytics/historical-comparison-table-engine";
import { columnKey } from "@/lib/analytics/historical-comparison-table-engine";
import type { TableIntelligenceOverlay } from "@/lib/analytics/historical-educational-intelligence";
import { buildHistoricalOutcomeIntelligence } from "@/lib/analytics/historical-outcome-intelligence";
import type { HistoricalYearSlice } from "@/lib/analytics/historical-comparison-fetch";
import { formatPercentage } from "@/lib/analytics/analytics-number-formatting";
import type { AnalyticsLocale } from "@/lib/analytics/analytics-semantic-registry";

export type TableExecutiveInsight = {
  cagr: number;
  volatility: number;
  peakYear: number;
  worstYear: number;
  bestPeriodAr: string;
  bestPeriodEn: string;
  warningAr: string | null;
  warningEn: string | null;
  miniInsightsAr: string[];
  miniInsightsEn: string[];
  outcomeScore: number;
  confidence: number;
};

export const buildTableExecutiveInsights = (
  slices: HistoricalYearSlice[],
  table: HistoricalComparisonTableModel,
  overlay?: TableIntelligenceOverlay | null,
  loc: AnalyticsLocale = "ar"
): TableExecutiveInsight => {
  const outcome = buildHistoricalOutcomeIntelligence(slices, table);
  const rows = table.rows.filter((r) => !r.isTotal);
  const years = table.yearGroups.map((g) => g.year);

  let peakYear = years[0] ?? 0;
  let worstYear = years[0] ?? 0;
  let peakVal = 0;
  let worstVal = Infinity;

  for (const y of years) {
    const sum = rows.reduce((s, r) => s + (r.cells[columnKey(y, "participation")] ?? 0), 0);
    if (sum > peakVal) {
      peakVal = sum;
      peakYear = y;
    }
    if (sum < worstVal) {
      worstVal = sum;
      worstYear = y;
    }
  }

  const cagr = overlay?.cagr ?? 0;
  const volatility = overlay?.volatility ?? 0;
  const warningAr =
    volatility > 45
      ? "تقلب مرتفع — راجع الاستقرار"
      : cagr < -10
        ? "انخفاض تاريخي ملحوظ"
        : null;
  const warningEn =
    volatility > 45
      ? "High volatility — review stability"
      : cagr < -10
        ? "Notable historical decline"
        : null;

  const miniInsightsAr = [
    `جودة التتويج: ${outcome.awardQuality}/100`,
    `كثافة الجوائز: ${formatPercentage(outcome.awardDensity, loc)}`,
    overlay ? `CAGR: ${formatPercentage(cagr, loc)}` : "",
    `ذروة المشاركة: ${peakYear}`,
  ].filter(Boolean);

  const miniInsightsEn = [
    `Award quality: ${outcome.awardQuality}/100`,
    `Award density: ${formatPercentage(outcome.awardDensity, loc)}`,
    overlay ? `CAGR: ${formatPercentage(cagr, loc)}` : "",
    `Participation peak: ${peakYear}`,
  ].filter(Boolean);

  return {
    cagr,
    volatility,
    peakYear,
    worstYear,
    bestPeriodAr: `${peakYear}`,
    bestPeriodEn: `${peakYear}`,
    warningAr,
    warningEn,
    miniInsightsAr,
    miniInsightsEn,
    outcomeScore: outcome.overall,
    confidence: outcome.confidence,
  };
};
