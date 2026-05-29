import { describe, expect, it } from "vitest";
import { detectOpportunityGaps } from "@/lib/analytics/analytics-opportunity-intelligence";
import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";

describe("opportunity-gap-detection", () => {
  it("flags activity concentration when dominance exceeds threshold", () => {
    const data = {
      ok: true,
      kpis: { totalParticipations: 50, distinctStudents: 40, goldMedalCount: 1 },
      charts: {
        sectionParticipation: [{ key: "arabic", labelAr: "عربي", labelEn: "Arabic", count: 50 }],
        genderParticipation: [
          { key: "male", labelAr: "بنين", labelEn: "Boys", count: 25 },
          { key: "female", labelAr: "بنات", labelEn: "Girls", count: 25 },
        ],
        mawhibaSplit: [
          { key: "yes", labelAr: "موهبة", labelEn: "Mawhiba", count: 25 },
          { key: "no", labelAr: "غير موهبة", labelEn: "Non-Mawhiba", count: 25 },
        ],
        levelDistribution: [],
        genderResultStack: [],
        activityHorizontal: [],
        yearTrend: [],
        resultOutcomeCompare: [],
        resultDistribution: [],
      },
      table: [
        {
          activityKey: "k",
          activityLabelAr: "كانجارو",
          activityLabelEn: "Kangaroo",
          totalParticipations: 50,
          distinctParticipants: 40,
          arabicParticipants: 45,
          internationalParticipants: 5,
          maleParticipants: 25,
          femaleParticipants: 25,
          mawhibaParticipants: 5,
          nonMawhibaParticipants: 45,
          goldMedalCount: 0,
          silverMedalCount: 0,
          bronzeMedalCount: 0,
          rankCount: 0,
          approvedAchievements: 0,
        },
      ],
    } as unknown as ParticipationAnalyticsPayload;

    const gaps = detectOpportunityGaps(data, "participation");
    expect(gaps.some((g) => g.kind === "activity_concentration")).toBe(true);
  });

  it("assigns critical severity for large section imbalance", () => {
    const data = {
      ok: true,
      kpis: { totalParticipations: 100, distinctStudents: 60, goldMedalCount: 2 },
      charts: {
        sectionParticipation: [
          { key: "arabic", labelAr: "عربي", labelEn: "Arabic", count: 90 },
          { key: "international", labelAr: "دولي", labelEn: "International", count: 10 },
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

    const gaps = detectOpportunityGaps(data, "participation");
    const sectionGap = gaps.find((g) => g.id === "representation_section");
    expect(sectionGap?.severity).toBe("critical");
  });
});
