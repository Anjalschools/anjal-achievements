import { describe, expect, it } from "vitest";
import {
  buildEducationalRecommendations,
  buildParticipationRecommendations,
  computeRecommendationScore,
} from "@/lib/analytics/analytics-recommendation-engine";
import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";

const payload = (): ParticipationAnalyticsPayload =>
  ({
    ok: true,
    kpis: { totalParticipations: 100, distinctStudents: 55, goldMedalCount: 4 },
    charts: {
      sectionParticipation: [
        { key: "arabic", labelAr: "عربي", labelEn: "Arabic", count: 72 },
        { key: "international", labelAr: "دولي", labelEn: "International", count: 28 },
      ],
      genderParticipation: [
        { key: "male", labelAr: "بنين", labelEn: "Boys", count: 58 },
        { key: "female", labelAr: "بنات", labelEn: "Girls", count: 42 },
      ],
      mawhibaSplit: [
        { key: "yes", labelAr: "موهبة", labelEn: "Mawhiba", count: 35 },
        { key: "no", labelAr: "غير موهبة", labelEn: "Non-Mawhiba", count: 65 },
      ],
      levelDistribution: [
        { labelAr: "أول ثانوي", labelEn: "Grade 10", count: 15 },
        { labelAr: "ثاني ثانوي", labelEn: "Grade 11", count: 85 },
      ],
      genderResultStack: [],
      activityHorizontal: [],
      yearTrend: [{ year: 2023, totalRows: 40, distinctStudents: 30, goldMedals: 1 }],
      resultOutcomeCompare: [],
      resultDistribution: [],
    },
    table: [
      {
        activityKey: "bebras",
        activityLabelAr: "بيبراس",
        activityLabelEn: "Bebras",
        totalParticipations: 40,
        distinctParticipants: 35,
        maleParticipants: 28,
        femaleParticipants: 12,
        arabicParticipants: 30,
        internationalParticipants: 10,
        mawhibaParticipants: 10,
        nonMawhibaParticipants: 30,
        goldMedalCount: 1,
        silverMedalCount: 0,
        bronzeMedalCount: 1,
        rankCount: 0,
        approvedAchievements: 2,
        excellenceRatePct: 5,
        levelLabelAr: "أول ثانوي",
        levelLabelEn: "Grade 10",
        typeKey: "competition",
        typeLabelAr: "مسابقة",
        typeLabelEn: "Competition",
      },
      {
        activityKey: "olympiad",
        activityLabelAr: "أولمبياد",
        activityLabelEn: "Olympiad",
        totalParticipations: 20,
        distinctParticipants: 18,
        maleParticipants: 12,
        femaleParticipants: 8,
        arabicParticipants: 15,
        internationalParticipants: 5,
        mawhibaParticipants: 14,
        nonMawhibaParticipants: 6,
        goldMedalCount: 2,
        silverMedalCount: 1,
        bronzeMedalCount: 0,
        rankCount: 0,
        approvedAchievements: 3,
        excellenceRatePct: 15,
        levelLabelAr: "أول ثانوي",
        levelLabelEn: "Grade 10",
        typeKey: "olympiad",
        typeLabelAr: "أولمبياد",
        typeLabelEn: "Olympiad",
      },
    ] as never,
    tableTotal: 2,
    tablePage: 1,
    tablePageSize: 25,
    activityOptions: [],
  }) as unknown as ParticipationAnalyticsPayload;

describe("analytics-recommendation-engine", () => {
  it("builds participation recommendations with trace and drill", () => {
    const recs = buildParticipationRecommendations(payload(), payload().table, "participation");
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0]?.trace.sourceDatasets.length).toBeGreaterThan(0);
    expect(recs[0]?.drillSource).toBeTruthy();
  });

  it("assembles bundle with categories and score", () => {
    const bundle = buildEducationalRecommendations(payload(), "participation");
    expect(bundle.recommendationScore).toBeGreaterThanOrEqual(0);
    expect(bundle.recommendationScore).toBeLessThanOrEqual(100);
    expect(bundle.recommendations.length).toBeGreaterThan(0);
    expect(
      bundle.byCategory.participation.length +
        bundle.byCategory.equity.length +
        bundle.byCategory.diversity.length
    ).toBeGreaterThan(0);
  });

  it("computes lower score when more high-impact recs exist", () => {
    const highImpact = Array.from({ length: 5 }).map((_, i) => ({
      opportunityImpact: 90,
      equityImpact: 90,
    })) as Parameters<typeof computeRecommendationScore>[0];
    const lowImpact = [{ opportunityImpact: 30, equityImpact: 30 }] as Parameters<
      typeof computeRecommendationScore
    >[0];
    expect(computeRecommendationScore(highImpact)).toBeLessThan(computeRecommendationScore(lowImpact));
  });
});
