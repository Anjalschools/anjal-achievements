import { describe, expect, it } from "vitest";
import {
  buildTrendIntelligence,
  computeHistoricalConsistencyScore,
  detectHistoricalPeaks,
} from "@/lib/analytics/historical-trend-intelligence";
import { computeTrendIndicators } from "@/lib/analytics/historical-trend-engine";

describe("historical-trend-intelligence", () => {
  const series = [
    { year: 2021, value: 40 },
    { year: 2022, value: 55 },
    { year: 2023, value: 70 },
    { year: 2024, value: 85 },
  ];

  it("computes CAGR and peaks", () => {
    const intel = buildTrendIntelligence(
      { kind: "activity", key: "kangaroo", labelAr: "كانجارو", labelEn: "Kangaroo" },
      "participation_count",
      series
    );
    expect(intel).not.toBeNull();
    expect(intel!.cagr).toBeGreaterThan(0);
    expect(intel!.peaks.bestYear).toBe(2024);
    expect(intel!.peaks.worstYear).toBe(2021);
  });

  it("scores consistency 0-100", () => {
    const indicators = computeTrendIndicators(series);
    const score = computeHistoricalConsistencyScore(indicators, "participation_count");
    expect(score.overall).toBeGreaterThanOrEqual(0);
    expect(score.overall).toBeLessThanOrEqual(100);
  });

  it("detects inflection and jump years", () => {
    const peaks = detectHistoricalPeaks(series);
    expect(peaks.largestJumpYear).toBeGreaterThan(2021);
    expect(peaks.inflectionYear).toBeGreaterThan(0);
  });
});
