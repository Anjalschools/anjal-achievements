/**
 * Forecast foundation — deterministic extrapolation (no ML).
 */

import { normalizeDecimal } from "@/lib/analytics/analytics-number-formatting";

export type ForecastPoint = {
  year: number;
  expected: number;
  lower: number;
  upper: number;
  confidence: number;
};

export type ForecastProjection = {
  horizonYears: number;
  points: ForecastPoint[];
  trendSlope: number;
  volatilityAdjusted: boolean;
};

const linearSlope = (series: Array<{ year: number; value: number }>): number => {
  if (series.length < 2) return 0;
  const n = series.length;
  const xMean = mean(series.map((p) => p.year));
  const yMean = mean(series.map((p) => p.value));
  let num = 0;
  let den = 0;
  for (const p of series) {
    num += (p.year - xMean) * (p.value - yMean);
    den += (p.year - xMean) ** 2;
  }
  return den === 0 ? 0 : num / den;
};

const mean = (values: number[]): number =>
  values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;

const volatility = (values: number[]): number => {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((s, v) => s + (v - m) ** 2, 0) / values.length);
};

/**
 * Simple trend extrapolation with volatility-adjusted confidence band.
 */
export const projectForecast = (
  series: Array<{ year: number; value: number }>,
  horizonYears = 1
): ForecastProjection => {
  const sorted = [...series].sort((a, b) => a.year - b.year);
  const slope = linearSlope(sorted);
  const values = sorted.map((p) => p.value);
  const vol = volatility(values);
  const last = sorted[sorted.length - 1] ?? { year: new Date().getFullYear(), value: 0 };
  const lastYear = last.year;

  const points: ForecastPoint[] = [];
  for (let h = 1; h <= horizonYears; h++) {
    const year = lastYear + h;
    const expected = Math.max(0, normalizeDecimal(last.value + slope * h, 1));
    const band = normalizeDecimal(Math.max(vol * 0.5, expected * 0.08), 1);
    const confidence = normalizeDecimal(Math.max(35, 90 - vol * 2 - h * 8), 0);
    points.push({
      year,
      expected,
      lower: Math.max(0, expected - band),
      upper: expected + band,
      confidence,
    });
  }

  return {
    horizonYears,
    points,
    trendSlope: normalizeDecimal(slope, 2),
    volatilityAdjusted: vol > 0,
  };
};

export const expectedGrowthPct = (
  series: Array<{ year: number; value: number }>,
  horizonYears = 1
): number => {
  const proj = projectForecast(series, horizonYears);
  const last = series[series.length - 1]?.value ?? 0;
  const next = proj.points[0]?.expected ?? last;
  if (last <= 0) return 0;
  return normalizeDecimal(((next - last) / last) * 100, 1);
};
