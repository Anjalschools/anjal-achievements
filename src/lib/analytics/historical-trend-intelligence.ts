/**
 * Historical Trend Intelligence — CAGR, momentum, peaks, consistency per scope.
 */

import type { HistoricalYearSlice } from "@/lib/analytics/historical-comparison-fetch";
import {
  ACTIVITY_FAMILIES,
  buildHistoricalComparisonTable,
  columnKey,
  type ActivityFamilyDef,
  type HistoricalComparisonTableModel,
} from "@/lib/analytics/historical-comparison-table-engine";
import { ROW_CATEGORIES } from "@/lib/analytics/shared/historical-row-categories";
import { extractMetric } from "@/lib/analytics/shared/historical-metric-extract";
import { normalizeDecimal } from "@/lib/analytics/analytics-number-formatting";
import {
  computeTrendIndicators,
  type TrendSeriesPoint,
} from "@/lib/analytics/historical-trend-engine";
import {
  getHistoricalMetricDef,
  type HistoricalMetricId,
} from "@/lib/analytics/historical-intelligence-registry";
import { memoizeStrategic, strategicCacheKey } from "@/lib/analytics/analytics-strategic-cache";

export type HistoricalScopeKind =
  | "activity"
  | "section"
  | "grade"
  | "gender"
  | "talent"
  | "year"
  | "platform";

export type HistoricalScope = {
  kind: HistoricalScopeKind;
  key: string;
  labelAr: string;
  labelEn: string;
};

export type HistoricalPeakInsight = {
  bestYear: number;
  worstYear: number;
  largestJumpYear: number;
  largestDropYear: number;
  mostStableYear: number;
  inflectionYear: number;
  bestValue: number;
  worstValue: number;
};

export type HistoricalConsistencyScore = {
  overall: number;
  stability: number;
  sustainability: number;
  growthQuality: number;
  volatilityResistance: number;
  labelAr: string;
  labelEn: string;
};

export type HistoricalTrendIntelligence = {
  scope: HistoricalScope;
  metricId: HistoricalMetricId;
  series: TrendSeriesPoint[];
  cagr: number;
  rollingGrowth: number;
  momentum: number;
  acceleration: number;
  deceleration: number;
  volatility: number;
  stability: number;
  recoveryRate: number;
  peaks: HistoricalPeakInsight;
  consistency: HistoricalConsistencyScore;
  semantic: "accelerating" | "declining" | "stable" | "volatile" | "recovery" | "peak";
};

const yoyGrowths = (series: TrendSeriesPoint[]): number[] => {
  const out: number[] = [];
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1]!.value;
    const cur = series[i]!.value;
    out.push(prev > 0 ? ((cur - prev) / prev) * 100 : cur > 0 ? 100 : 0);
  }
  return out;
};

export const computeHistoricalConsistencyScore = (
  indicators: ReturnType<typeof computeTrendIndicators>,
  metricId: HistoricalMetricId
): HistoricalConsistencyScore => {
  const def = getHistoricalMetricDef(metricId);
  const volPenalty = Math.min(100, indicators.volatility * def.volatilitySensitivity * 2);
  const stability = normalizeDecimal(Math.max(0, 100 - volPenalty), 0);
  const growthQuality = normalizeDecimal(
    Math.max(0, Math.min(100, 50 + indicators.cagr * 2 + indicators.momentum * 0.5)),
    0
  );
  const sustainability = normalizeDecimal(
    indicators.sustainabilityScore || stability * 0.55 + growthQuality * 0.45,
    0
  );
  const volatilityResistance = normalizeDecimal(
    Math.max(0, 100 - indicators.volatility * (1 + def.volatilitySensitivity)),
    0
  );
  const overall = normalizeDecimal(
    stability * 0.3 + sustainability * 0.25 + growthQuality * 0.25 + volatilityResistance * 0.2,
    0
  );

  const label =
    overall >= def.consistencyThresholds.stable
      ? { ar: "استقرار عالي", en: "High stability" }
      : overall >= def.consistencyThresholds.volatile
        ? { ar: "استقرار متوسط", en: "Moderate stability" }
        : { ar: "تقلب مرتفع", en: "High volatility" };

  return {
    overall,
    stability,
    sustainability,
    growthQuality,
    volatilityResistance,
    labelAr: label.ar,
    labelEn: label.en,
  };
};

export const detectHistoricalPeaks = (series: TrendSeriesPoint[]): HistoricalPeakInsight => {
  if (series.length === 0) {
    return {
      bestYear: 0,
      worstYear: 0,
      largestJumpYear: 0,
      largestDropYear: 0,
      mostStableYear: 0,
      inflectionYear: 0,
      bestValue: 0,
      worstValue: 0,
    };
  }

  const values = series.map((p) => p.value);
  const bestIdx = values.reduce((b, v, i) => (v > values[b]! ? i : b), 0);
  const worstIdx = values.reduce((b, v, i) => (v < values[b]! ? i : b), 0);
  const growths = yoyGrowths(series);

  let jumpIdx = 0;
  let dropIdx = 0;
  let maxJump = -Infinity;
  let maxDrop = Infinity;
  for (let i = 0; i < growths.length; i++) {
    if (growths[i]! > maxJump) {
      maxJump = growths[i]!;
      jumpIdx = i + 1;
    }
    if (growths[i]! < maxDrop) {
      maxDrop = growths[i]!;
      dropIdx = i + 1;
    }
  }

  let stableIdx = 0;
  let minDelta = Infinity;
  for (let i = 1; i < values.length; i++) {
    const d = Math.abs(values[i]! - values[i - 1]!);
    if (d < minDelta) {
      minDelta = d;
      stableIdx = i;
    }
  }

  let inflectionIdx = Math.floor(series.length / 2);
  if (growths.length >= 2) {
    for (let i = 1; i < growths.length; i++) {
      if ((growths[i - 1]! < 0 && growths[i]! >= 0) || (growths[i - 1]! > 0 && growths[i]! <= 0)) {
        inflectionIdx = i + 1;
        break;
      }
    }
  }

  return {
    bestYear: series[bestIdx]?.year ?? 0,
    worstYear: series[worstIdx]?.year ?? 0,
    largestJumpYear: series[jumpIdx]?.year ?? series[0]!.year,
    largestDropYear: series[dropIdx]?.year ?? series[0]!.year,
    mostStableYear: series[stableIdx]?.year ?? series[0]!.year,
    inflectionYear: series[inflectionIdx]?.year ?? series[0]!.year,
    bestValue: values[bestIdx] ?? 0,
    worstValue: values[worstIdx] ?? 0,
  };
};

const resolveSemantic = (
  indicators: ReturnType<typeof computeTrendIndicators>
): HistoricalTrendIntelligence["semantic"] => {
  if (indicators.recoveryRate >= 35 && indicators.momentum > 0) return "recovery";
  if (indicators.cagr >= 8 && indicators.acceleration > 1) return "accelerating";
  if (indicators.cagr <= -6) return "declining";
  if (indicators.volatility > indicators.consistency) return "volatile";
  if (indicators.historicalPeak.year === indicators.historicalLow.year && indicators.cagr > 0) {
    return "peak";
  }
  return "stable";
};

export const buildTrendIntelligence = (
  scope: HistoricalScope,
  metricId: HistoricalMetricId,
  series: TrendSeriesPoint[]
): HistoricalTrendIntelligence | null => {
  if (series.length < 2) return null;
  const indicators = computeTrendIndicators(series);
  const peaks = detectHistoricalPeaks(series);
  const consistency = computeHistoricalConsistencyScore(indicators, metricId);

  return {
    scope,
    metricId,
    series,
    cagr: indicators.cagr,
    rollingGrowth: indicators.rollingGrowth,
    momentum: indicators.momentum,
    acceleration: indicators.acceleration,
    deceleration: indicators.deceleration,
    volatility: indicators.volatility,
    stability: indicators.consistency,
    recoveryRate: indicators.recoveryRate,
    peaks,
    consistency,
    semantic: resolveSemantic(indicators),
  };
};

const seriesFromTable = (
  model: HistoricalComparisonTableModel,
  metricKey: string,
  rowKey?: string
): TrendSeriesPoint[] => {
  const rows = model.rows.filter((r) => !r.isTotal && (!rowKey || r.key === rowKey));
  const years = model.yearGroups.map((g) => g.year).sort((a, b) => a - b);
  return years.map((year) => {
    const sum = rows.reduce((s, r) => s + (r.cells[columnKey(year, metricKey)] ?? 0), 0);
    return { year, value: sum };
  });
};

export const buildActivityTrendIntelligence = (
  slices: HistoricalYearSlice[],
  family: ActivityFamilyDef,
  metricId: HistoricalMetricId = "participation_count"
): HistoricalTrendIntelligence | null => {
  const def = getHistoricalMetricDef(metricId);
  const metricKey = def.tableMetricKey ?? "participation";
  const model = buildHistoricalComparisonTable({ family, slices });
  if (!model) return null;
  const series = seriesFromTable(model, metricKey);
  return buildTrendIntelligence(
    {
      kind: "activity",
      key: family.key,
      labelAr: family.labelAr,
      labelEn: family.labelEn,
    },
    metricId,
    series
  );
};

export const buildSectionTrendIntelligence = (
  slices: HistoricalYearSlice[],
  family: ActivityFamilyDef,
  rowKey: string,
  metricId: HistoricalMetricId = "participation_count"
): HistoricalTrendIntelligence | null => {
  const def = getHistoricalMetricDef(metricId);
  const metricKey = def.tableMetricKey ?? "participation";
  const model = buildHistoricalComparisonTable({ family, slices });
  if (!model) return null;
  const cat = ROW_CATEGORIES.find((c) => c.key === rowKey);
  const series = seriesFromTable(model, metricKey, rowKey);
  return buildTrendIntelligence(
    {
      kind: "section",
      key: rowKey,
      labelAr: cat?.labelAr ?? rowKey,
      labelEn: cat?.labelEn ?? rowKey,
    },
    metricId,
    series
  );
};

export const buildAllActivityTrendIntelligence = (
  slices: HistoricalYearSlice[],
  metricId: HistoricalMetricId = "participation_count"
): HistoricalTrendIntelligence[] => {
  const key = strategicCacheKey({
    m: metricId,
    y: slices.map((s) => s.year).join(","),
    n: "activity-trends",
  });

  return memoizeStrategic("historical", key, () => {
    const out: HistoricalTrendIntelligence[] = [];
    for (const family of ACTIVITY_FAMILIES) {
      const has = slices.some((s) => s.payload.table.some(family.match));
      if (!has) continue;
      const intel = buildActivityTrendIntelligence(slices, family, metricId);
      if (intel) out.push(intel);
    }
    return out.sort((a, b) => b.cagr - a.cagr);
  });
};

export const buildPlatformTrendIntelligence = (
  slices: HistoricalYearSlice[]
): HistoricalTrendIntelligence | null => {
  const series: TrendSeriesPoint[] = slices
    .sort((a, b) => a.year - b.year)
    .map((s) => ({
      year: s.year,
      value: s.payload.kpis.totalParticipations,
    }));
  return buildTrendIntelligence(
    { kind: "platform", key: "all", labelAr: "المنصة", labelEn: "Platform" },
    "participation_count",
    series
  );
};

/** Equity: international vs arabic participation share stability */
export const buildEquityTrendIntelligence = (
  slices: HistoricalYearSlice[]
): HistoricalTrendIntelligence | null => {
  const series: TrendSeriesPoint[] = slices
    .sort((a, b) => a.year - b.year)
    .map((s) => {
      const intl = s.payload.table.reduce((sum, r) => sum + r.internationalParticipants, 0);
      const ar = s.payload.table.reduce((sum, r) => sum + r.arabicParticipants, 0);
      const total = intl + ar;
      const gap = total > 0 ? normalizeDecimal(Math.abs(intl - ar) / total * 100, 1) : 0;
      return { year: s.year, value: gap };
    });
  return buildTrendIntelligence(
    { kind: "gender", key: "equity", labelAr: "الإنصاف", labelEn: "Equity" },
    "equity_gap",
    series
  );
};

export const extractFamilySeriesByYear = (
  slices: HistoricalYearSlice[],
  family: ActivityFamilyDef,
  metricKey: string
): TrendSeriesPoint[] =>
  slices
    .sort((a, b) => a.year - b.year)
    .map((slice) => {
      const rows = slice.payload.table.filter(family.match);
      return { year: slice.year, value: extractMetric(rows, metricKey) };
    });
