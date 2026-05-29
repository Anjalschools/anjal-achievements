/**
 * Historical Trend Engine — longitudinal analysis (CAGR, momentum, narratives).
 */

import type { HistoricalYearSlice } from "@/lib/analytics/historical-comparison-fetch";
import {
  computeMetricFromPayload,
  formatMetricValue,
  getMetricDefinition,
  type MetricId,
  type TrendSemantic,
} from "@/lib/analytics/analytics-metric-registry";
import { normalizeDecimal } from "@/lib/analytics/analytics-number-formatting";
import { memoizeStrategic, strategicCacheKey } from "@/lib/analytics/analytics-strategic-cache";

export type TrendSeriesPoint = { year: number; value: number };

export type HistoricalTrendIndicators = {
  cagr: number;
  rollingGrowth: number;
  acceleration: number;
  deceleration: number;
  volatility: number;
  consistency: number;
  historicalPeak: { year: number; value: number };
  historicalLow: { year: number; value: number };
  recoveryRate: number;
  momentum: number;
  sustainabilityScore: number;
};

export type HistoricalTrendNarrative = {
  id: string;
  metricId: MetricId;
  semantic: TrendSemantic;
  bodyAr: string;
  bodyEn: string;
  priority: number;
};

export type HistoricalTrendAnalysis = {
  metricId: MetricId;
  series: TrendSeriesPoint[];
  indicators: HistoricalTrendIndicators;
  semantic: TrendSemantic;
  narratives: HistoricalTrendNarrative[];
};

const extractSeries = (
  slices: HistoricalYearSlice[],
  metricId: MetricId
): TrendSeriesPoint[] =>
  slices
    .sort((a, b) => a.year - b.year)
    .map((s) => {
      const p = s.payload;
      const medals =
        p.kpis.goldMedalCount +
        p.table.reduce((sum, r) => sum + r.silverMedalCount + r.bronzeMedalCount, 0);
      const value = computeMetricFromPayload(metricId, {
        participations: p.kpis.totalParticipations,
        students: p.kpis.distinctStudents,
        medals,
        nominations: p.kpis.nominationCount,
        acceptances: p.table.reduce((sum, r) => sum + r.approvedAchievements, 0),
      });
      return { year: s.year, value };
    });

const mean = (values: number[]): number =>
  values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;

const stdDev = (values: number[]): number => {
  if (values.length < 2) return 0;
  const m = mean(values);
  const v = values.reduce((s, x) => s + (x - m) ** 2, 0) / values.length;
  return Math.sqrt(v);
};

const computeCagr = (series: TrendSeriesPoint[]): number => {
  if (series.length < 2) return 0;
  const first = series[0]!;
  const last = series[series.length - 1]!;
  const years = last.year - first.year;
  if (years <= 0 || first.value <= 0) return 0;
  const ratio = last.value / first.value;
  return normalizeDecimal((Math.pow(ratio, 1 / years) - 1) * 100, 1);
};

const yoyGrowths = (series: TrendSeriesPoint[]): number[] => {
  const out: number[] = [];
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1]!.value;
    const cur = series[i]!.value;
    out.push(prev > 0 ? ((cur - prev) / prev) * 100 : 0);
  }
  return out;
};

export const computeTrendIndicators = (series: TrendSeriesPoint[]): HistoricalTrendIndicators => {
  const values = series.map((p) => p.value);
  const growths = yoyGrowths(series);
  const peakIdx = values.reduce((best, v, i) => (v > values[best]! ? i : best), 0);
  const lowIdx = values.reduce((best, v, i) => (v < values[best]! ? i : best), 0);
  const peak = { year: series[peakIdx]?.year ?? 0, value: values[peakIdx] ?? 0 };
  const low = { year: series[lowIdx]?.year ?? 0, value: values[lowIdx] ?? 0 };

  const rollingGrowth =
    growths.length > 0 ? normalizeDecimal(mean(growths.slice(-Math.min(3, growths.length))), 1) : 0;
  const acceleration =
    growths.length >= 2
      ? normalizeDecimal(growths[growths.length - 1]! - growths[growths.length - 2]!, 1)
      : 0;
  const volatility = normalizeDecimal(stdDev(values), 1);
  const consistency = normalizeDecimal(Math.max(0, 100 - volatility), 0);

  const afterPeak = series.filter((p) => p.year > peak.year);
  const recoveryRate =
    peak.value > 0 && afterPeak.length > 0
      ? normalizeDecimal(
          ((afterPeak[afterPeak.length - 1]!.value - low.value) / Math.max(peak.value - low.value, 1)) *
            100,
          1
        )
      : 0;

  const momentum = normalizeDecimal(rollingGrowth + acceleration * 0.5, 1);
  const sustainabilityScore = normalizeDecimal(consistency * 0.6 + Math.max(0, momentum) * 0.4, 0);

  return {
    cagr: computeCagr(series),
    rollingGrowth,
    acceleration,
    deceleration: acceleration < 0 ? Math.abs(acceleration) : 0,
    volatility,
    consistency,
    historicalPeak: peak,
    historicalLow: low,
    recoveryRate,
    momentum,
    sustainabilityScore,
  };
};

export const resolveTrendSemantic = (
  indicators: HistoricalTrendIndicators
): TrendSemantic => {
  if (indicators.cagr >= 12 && indicators.acceleration > 2) return "accelerating";
  if (indicators.cagr <= -8) return "declining";
  if (indicators.volatility > indicators.consistency) return "volatile";
  if (
    indicators.historicalPeak.value > 0 &&
    indicators.historicalLow.year < indicators.historicalPeak.year &&
    indicators.recoveryRate >= 40
  ) {
    return "recovery";
  }
  if (indicators.cagr >= 5 && indicators.momentum > 0) return "emerging_growth";
  if (indicators.rollingGrowth > 0 && indicators.historicalPeak.year === indicators.historicalLow.year) {
    return "historical_peak";
  }
  return "stable";
};

export const buildTrendNarratives = (
  analysis: HistoricalTrendAnalysis,
  activityLabel?: { ar: string; en: string }
): HistoricalTrendNarrative[] => {
  const m = getMetricDefinition(analysis.metricId);
  const label = activityLabel ?? { ar: "النشاط", en: "Activity" };
  const fmt = (v: number) => formatMetricValue(analysis.metricId, v, "ar");
  const narratives: HistoricalTrendNarrative[] = [];
  const { indicators, semantic } = analysis;

  if (indicators.cagr >= 8) {
    narratives.push({
      id: "cagr_leader",
      metricId: analysis.metricId,
      semantic: "accelerating",
      bodyAr: `${label.ar} يمتلك أسرع نمو تراكمي (${indicators.cagr}%) خلال ${analysis.series.length} سنوات — ${m.narrativeWording.up.ar}.`,
      bodyEn: `${label.en} shows the fastest cumulative growth (${indicators.cagr}% CAGR) over ${analysis.series.length} years.`,
      priority: 90,
    });
  }

  if (semantic === "declining" && indicators.historicalPeak.year > 0) {
    narratives.push({
      id: "post_peak_decline",
      metricId: analysis.metricId,
      semantic: "declining",
      bodyAr: `انخفض المؤشر بعد ذروة ${indicators.historicalPeak.year} (${fmt(indicators.historicalPeak.value)}).`,
      bodyEn: `Metric declined after the ${indicators.historicalPeak.year} peak (${fmt(indicators.historicalPeak.value)}).`,
      priority: 85,
    });
  }

  if (semantic === "stable" && indicators.consistency >= 70) {
    narratives.push({
      id: "high_stability",
      metricId: analysis.metricId,
      semantic: "stable",
      bodyAr: `استقرار مرتفع في ${label.ar} (اتساق ${indicators.consistency}%).`,
      bodyEn: `High stability in ${label.en} (consistency ${indicators.consistency}%).`,
      priority: 70,
    });
  }

  if (semantic === "recovery") {
    narratives.push({
      id: "recovery_signal",
      metricId: analysis.metricId,
      semantic: "recovery",
      bodyAr: `إشارة تعافٍ: معدل استرداد ${indicators.recoveryRate}% بعد أدنى قيمة.`,
      bodyEn: `Recovery signal: ${indicators.recoveryRate}% recovery rate after historical low.`,
      priority: 80,
    });
  }

  if (indicators.momentum >= 10) {
    narratives.push({
      id: "momentum_up",
      metricId: analysis.metricId,
      semantic: "emerging_growth",
      bodyAr: `زخم إيجابي (${indicators.momentum}) مع نمو متحرك ${indicators.rollingGrowth}%.`,
      bodyEn: `Positive momentum (${indicators.momentum}) with rolling growth ${indicators.rollingGrowth}%.`,
      priority: 75,
    });
  }

  return narratives.sort((a, b) => b.priority - a.priority);
};

export const buildHistoricalTrendAnalysis = (
  slices: HistoricalYearSlice[],
  metricId: MetricId = "participation_count"
): HistoricalTrendAnalysis => {
  const key = strategicCacheKey({
    m: metricId,
    y: slices.map((s) => s.year).join(","),
    p: String(slices[0]?.payload.kpis.totalParticipations ?? 0),
  });

  return memoizeStrategic("trend", key, () => {
    const series = extractSeries(slices, metricId);
    const indicators = computeTrendIndicators(series);
    const semantic = resolveTrendSemantic(indicators);
    const analysis: HistoricalTrendAnalysis = {
      metricId,
      series,
      indicators,
      semantic,
      narratives: [],
    };
    analysis.narratives = buildTrendNarratives(analysis);
    return analysis;
  });
};

export const buildMultiMetricTrendBundle = (
  slices: HistoricalYearSlice[],
  metricIds: MetricId[] = ["participation_count", "medal_conversion", "historical_growth"]
): HistoricalTrendAnalysis[] => metricIds.map((id) => buildHistoricalTrendAnalysis(slices, id));
