import { describe, expect, it } from "vitest";
import { computeHistoricalRate } from "@/lib/analytics/historical-results-metric-semantics";
import type { ParticipationActivityRow } from "@/lib/achievement-participation-analytics";

describe("historical-award-rate", () => {
  it("computes award rate as medals over participation", () => {
    const rows = [
      {
        totalParticipations: 100,
        goldMedalCount: 5,
        silverMedalCount: 5,
        bronzeMedalCount: 0,
      } as ParticipationActivityRow,
    ];
    const rate = computeHistoricalRate(rows, "award_rate");
    expect(rate).toBe(10);
  });
});
