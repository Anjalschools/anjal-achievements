import { describe, expect, it } from "vitest";
import { computeHistoricalConsistencyScore } from "@/lib/analytics/historical-trend-intelligence";
import { computeTrendIndicators } from "@/lib/analytics/historical-trend-engine";

describe("historical-consistency-score", () => {
  it("rewards stable growth series", () => {
    const stable = computeTrendIndicators([
      { year: 2021, value: 50 },
      { year: 2022, value: 52 },
      { year: 2023, value: 54 },
      { year: 2024, value: 56 },
    ]);
    const volatile = computeTrendIndicators([
      { year: 2021, value: 10 },
      { year: 2022, value: 90 },
      { year: 2023, value: 15 },
      { year: 2024, value: 80 },
    ]);
    const stableScore = computeHistoricalConsistencyScore(stable, "participation_count");
    const volatileScore = computeHistoricalConsistencyScore(volatile, "participation_count");
    expect(stableScore.stability).toBeGreaterThan(volatileScore.stability);
    expect(stableScore.volatilityResistance).toBeGreaterThan(volatileScore.volatilityResistance);
  });
});
