import { describe, expect, it } from "vitest";
import { buildEquityIntelligence } from "@/lib/analytics/analytics-equity-intelligence";
import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";

const minimal = (): ParticipationAnalyticsPayload =>
  ({
    ok: true,
    kpis: { totalParticipations: 80, distinctStudents: 50, goldMedalCount: 2 },
    charts: {
      genderParticipation: [
        { key: "male", labelAr: "بنين", labelEn: "Boys", count: 50 },
        { key: "female", labelAr: "بنات", labelEn: "Girls", count: 30 },
      ],
      mawhibaSplit: [
        { key: "yes", labelAr: "موهبة", labelEn: "Mawhiba", count: 35 },
        { key: "no", labelAr: "غير موهبة", labelEn: "Non-Mawhiba", count: 45 },
      ],
      sectionParticipation: [
        { key: "arabic", labelAr: "عربي", labelEn: "Arabic", count: 55 },
        { key: "international", labelAr: "دولي", labelEn: "International", count: 25 },
      ],
      levelDistribution: [],
      genderResultStack: [],
      activityHorizontal: [],
      yearTrend: [],
      resultOutcomeCompare: [],
      resultDistribution: [],
    },
    table: [{ approvedAchievements: 10, activityLabelAr: "كانجارو", activityLabelEn: "Kangaroo" } as never],
  }) as unknown as ParticipationAnalyticsPayload;

describe("analytics-equity-intelligence", () => {
  it("computes equity score and indicators", () => {
    const bundle = buildEquityIntelligence(minimal(), "participation");
    expect(bundle.equityScore).toBeGreaterThanOrEqual(0);
    expect(bundle.equityScore).toBeLessThanOrEqual(100);
    expect(bundle.indicators.length).toBe(6);
  });

  it("emits underrepresentation narrative for girls when low", () => {
    const bundle = buildEquityIntelligence(minimal(), "participation");
    expect(bundle.narratives.some((n) => n.id === "equity_girls_under")).toBe(true);
  });
});
