import { describe, expect, it } from "vitest";
import { buildComparisonWorkspace, formatDeltaIndicator } from "@/lib/analytics/analytics-comparison-mode";
import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";

const payload = (): ParticipationAnalyticsPayload =>
  ({
    ok: true,
    kpis: {
      totalParticipations: 100,
      distinctStudents: 60,
      goldMedalCount: 5,
      internationalAchievementPct: 0,
      internationalSectionPct: 30,
    },
    charts: {
      sectionParticipation: [
        { key: "arabic", labelAr: "عربي", labelEn: "Arabic", count: 70 },
        { key: "international", labelAr: "دولي", labelEn: "International", count: 30 },
      ],
      genderParticipation: [
        { key: "male", labelAr: "بنين", labelEn: "Boys", count: 55 },
        { key: "female", labelAr: "بنات", labelEn: "Girls", count: 45 },
      ],
      mawhibaSplit: [
        { key: "yes", labelAr: "موهبة", labelEn: "Mawhiba", count: 40 },
        { key: "no", labelAr: "غير موهبة", labelEn: "Non-Mawhiba", count: 60 },
      ],
      genderResultStack: [
        { gender: "male", gold: 3, silver: 1, bronze: 1, ranks: 0 },
        { gender: "female", gold: 2, silver: 2, bronze: 2, ranks: 0 },
      ],
      levelDistribution: [
        { labelAr: "الصف الثالث", labelEn: "Grade 3", count: 60 },
        { labelAr: "الصف الثاني", labelEn: "Grade 2", count: 40 },
      ],
      yearTrend: [
        { year: 2023, totalRows: 40, distinctStudents: 30, goldMedals: 2 },
        { year: 2024, totalRows: 60, distinctStudents: 45, goldMedals: 3 },
      ],
      activityHorizontal: [],
      resultOutcomeCompare: [],
      resultDistribution: [],
    },
    table: [
      {
        activityKey: "kangaroo",
        activityLabelAr: "كانجارو",
        activityLabelEn: "Kangaroo",
        totalParticipations: 50,
        distinctParticipants: 40,
        goldMedalCount: 2,
        silverMedalCount: 1,
        bronzeMedalCount: 1,
        rankCount: 0,
        maleParticipants: 25,
        femaleParticipants: 25,
        arabicParticipants: 30,
        internationalParticipants: 20,
        mawhibaParticipants: 15,
        nonMawhibaParticipants: 35,
        approvedAchievements: 4,
        typeKey: "competition",
        typeLabelAr: "مسابقة",
        typeLabelEn: "Competition",
        levelLabelAr: "G9",
        levelLabelEn: "G9",
      },
      {
        activityKey: "bebras",
        activityLabelAr: "بيبراس",
        activityLabelEn: "Bebras",
        totalParticipations: 30,
        distinctParticipants: 25,
        goldMedalCount: 1,
        silverMedalCount: 0,
        bronzeMedalCount: 1,
        rankCount: 0,
        maleParticipants: 15,
        femaleParticipants: 15,
        arabicParticipants: 20,
        internationalParticipants: 10,
        mawhibaParticipants: 10,
        nonMawhibaParticipants: 20,
        approvedAchievements: 2,
        typeKey: "competition",
        typeLabelAr: "مسابقة",
        typeLabelEn: "Competition",
        levelLabelAr: "G8",
        levelLabelEn: "G8",
      },
    ] as never,
    tableTotal: 2,
    tablePage: 1,
    tablePageSize: 25,
    activityOptions: [],
  }) as unknown as ParticipationAnalyticsPayload;

describe("analytics-comparison-mode", () => {
  it("builds section comparison with deltas", () => {
    const bundle = buildComparisonWorkspace(payload(), "section", "participation");
    expect(bundle).not.toBeNull();
    expect(bundle!.deltas.length).toBeGreaterThanOrEqual(5);
    expect(bundle!.sideA.participations).toBeGreaterThan(bundle!.sideB.participations);
  });

  it("shifts student perspective metrics", () => {
    const bundle = buildComparisonWorkspace(payload(), "gender", "student");
    expect(bundle).not.toBeNull();
    expect(bundle!.narratives.some((n) => n.id === "comparison_students_lead")).toBe(true);
  });

  it("formats delta indicators", () => {
    const gain = formatDeltaIndicator(12, "en");
    expect(gain.tone).toBe("gain");
    expect(gain.text).toContain("+");
  });
});
