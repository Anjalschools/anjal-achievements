import { describe, expect, it } from "vitest";
import {
  computeHistoricalRate,
  computeParticipationCount,
  isRateMetric,
  shouldShowMedalPlaceholder,
} from "@/lib/analytics/historical-results-metric-semantics";
import type { ParticipationActivityRow } from "@/lib/achievement-participation-analytics";

const row = (overrides?: Partial<ParticipationActivityRow>): ParticipationActivityRow =>
  ({
    activityKey: "k",
    activityLabelAr: "كانجارو",
    activityLabelEn: "Kangaroo",
    totalParticipations: 20,
    goldMedalCount: 0,
    silverMedalCount: 0,
    bronzeMedalCount: 0,
    nominationCount: 4,
    approvedAchievements: 2,
    rankCount: 0,
    mawhibaParticipants: 0,
    participationOnlyCount: 0,
    excellenceRatePct: 0,
    ...overrides,
  }) as ParticipationActivityRow;

describe("historical-results-table-semantics", () => {
  it("identifies rate metrics", () => {
    expect(isRateMetric("award_rate")).toBe(true);
    expect(isRateMetric("participation")).toBe(false);
  });

  it("shows medal placeholder when participation exists but medals are zero", () => {
    expect(shouldShowMedalPlaceholder("gold", 0, 20)).toBe(true);
    expect(shouldShowMedalPlaceholder("gold", 2, 20)).toBe(false);
  });

  it("returns null award rate without medals", () => {
    expect(computeHistoricalRate([row()], "award_rate")).toBeNull();
  });

  it("computes participation count", () => {
    expect(computeParticipationCount([row(), row({ totalParticipations: 5 })])).toBe(25);
  });
});
