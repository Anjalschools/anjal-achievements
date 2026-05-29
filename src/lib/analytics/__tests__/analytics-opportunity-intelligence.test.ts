import { describe, expect, it } from "vitest";
import {
  buildOpportunityIntelligence,
  buildOpportunityAlerts,
  computeOpportunityScore,
  detectOpportunityGaps,
} from "@/lib/analytics/analytics-opportunity-intelligence";
import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";

const payload = (): ParticipationAnalyticsPayload =>
  ({
    ok: true,
    kpis: { totalParticipations: 100, distinctStudents: 55, goldMedalCount: 4 },
    charts: {
      sectionParticipation: [
        { key: "arabic", labelAr: "عربي", labelEn: "Arabic", count: 75 },
        { key: "international", labelAr: "دولي", labelEn: "International", count: 25 },
      ],
      genderParticipation: [
        { key: "male", labelAr: "بنين", labelEn: "Boys", count: 58 },
        { key: "female", labelAr: "بنات", labelEn: "Girls", count: 42 },
      ],
      mawhibaSplit: [
        { key: "yes", labelAr: "موهبة", labelEn: "Mawhiba", count: 70 },
        { key: "no", labelAr: "غير موهبة", labelEn: "Non-Mawhiba", count: 30 },
      ],
      levelDistribution: [
        { labelAr: "أول ثانوي", labelEn: "Grade 10", count: 20 },
        { labelAr: "ثاني ثانوي", labelEn: "Grade 11", count: 80 },
      ],
      genderResultStack: [
        { gender: "female", gold: 2, silver: 1, bronze: 2, ranks: 0 },
        { gender: "male", gold: 2, silver: 0, bronze: 1, ranks: 0 },
      ],
      activityHorizontal: [],
      yearTrend: [],
      resultOutcomeCompare: [],
      resultDistribution: [],
    },
    table: [
      {
        activityKey: "kangaroo",
        activityLabelAr: "كانجارو",
        activityLabelEn: "Kangaroo",
        totalParticipations: 60,
        distinctParticipants: 50,
        arabicParticipants: 50,
        internationalParticipants: 10,
        maleParticipants: 30,
        femaleParticipants: 30,
        mawhibaParticipants: 10,
        nonMawhibaParticipants: 50,
        goldMedalCount: 1,
        silverMedalCount: 1,
        bronzeMedalCount: 1,
        rankCount: 0,
        approvedAchievements: 3,
        typeKey: "competition",
        typeLabelAr: "مسابقة",
        typeLabelEn: "Competition",
        levelLabelAr: "G10",
        levelLabelEn: "G10",
      },
      {
        activityKey: "bebras",
        activityLabelAr: "بيبراس",
        activityLabelEn: "Bebras",
        totalParticipations: 40,
        distinctParticipants: 35,
        arabicParticipants: 25,
        internationalParticipants: 15,
        maleParticipants: 28,
        femaleParticipants: 12,
        mawhibaParticipants: 30,
        nonMawhibaParticipants: 10,
        goldMedalCount: 1,
        silverMedalCount: 0,
        bronzeMedalCount: 0,
        rankCount: 0,
        approvedAchievements: 2,
        typeKey: "competition",
        typeLabelAr: "مسابقة",
        typeLabelEn: "Competition",
        levelLabelAr: "G11",
        levelLabelEn: "G11",
      },
    ] as never,
    tableTotal: 2,
    tablePage: 1,
    tablePageSize: 25,
    activityOptions: [],
  }) as unknown as ParticipationAnalyticsPayload;

describe("analytics-opportunity-intelligence", () => {
  it("computes opportunity score with tier", () => {
    const { score, tier } = computeOpportunityScore(payload(), "participation");
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
    expect(["excellent", "balanced", "warning", "critical"]).toContain(tier);
  });

  it("detects participation and representation gaps", () => {
    const gaps = detectOpportunityGaps(payload(), "participation");
    expect(gaps.some((g) => g.kind === "participation_gap")).toBe(true);
    expect(gaps.some((g) => g.kind === "representation_gap")).toBe(true);
  });

  it("builds alerts with trace and drill metadata", () => {
    const alerts = buildOpportunityAlerts(payload(), "participation");
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0]?.trace.perspective).toBe("participation");
    expect(alerts[0]?.drillSource).toBeTruthy();
  });

  it("assembles full opportunity bundle", () => {
    const bundle = buildOpportunityIntelligence(payload(), "student");
    expect(bundle.heatmap.length).toBeGreaterThan(0);
    expect(bundle.concentrations.length).toBeGreaterThan(0);
    expect(bundle.recommendations.length).toBeGreaterThan(0);
  });
});
