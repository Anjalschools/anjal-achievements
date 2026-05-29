import { describe, expect, it } from "vitest";
import { buildRecommendationComparisonDeltas } from "@/lib/analytics/analytics-recommendation-engine";
import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";

const minimal = {
  ok: true,
  kpis: { totalParticipations: 80, distinctStudents: 40, goldMedalCount: 2 },
  charts: {
    sectionParticipation: [
      { key: "arabic", labelAr: "عربي", labelEn: "Arabic", count: 60 },
      { key: "international", labelAr: "دولي", labelEn: "International", count: 20 },
    ],
    genderParticipation: [],
    mawhibaSplit: [],
    levelDistribution: [],
    genderResultStack: [],
    activityHorizontal: [],
    yearTrend: [],
    resultOutcomeCompare: [],
    resultDistribution: [],
  },
  table: [],
} as unknown as ParticipationAnalyticsPayload;

describe("recommendation-intelligence", () => {
  it("exposes recommendation comparison deltas for sections", () => {
    const deltas = buildRecommendationComparisonDeltas(minimal, "arabic", "international", "section");
    expect(deltas).toHaveLength(4);
    expect(deltas.some((d) => d.key === "participation_improvement")).toBe(true);
    expect(deltas.some((d) => d.key === "equity_improvement")).toBe(true);
  });
});
