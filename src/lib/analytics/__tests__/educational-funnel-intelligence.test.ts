import { describe, expect, it } from "vitest";
import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";
import {
  buildAllEducationalFunnels,
  buildCompetitionFunnel,
  buildFunnelNarratives,
  buildTalentFunnel,
} from "@/lib/analytics/educational-funnel-intelligence";
import { invalidateStrategicCache } from "@/lib/analytics/analytics-strategic-cache";

const payload = (): ParticipationAnalyticsPayload => ({
  ok: true,
  generatedAt: new Date().toISOString(),
  filters: {},
  kpis: {
    totalParticipations: 500,
    distinctStudents: 200,
    mawhibaParticipationPct: 35,
    femalePct: 48,
    internationalSectionPct: 22,
    activeProgramsCount: 6,
    topProgramLabelAr: "—",
    topProgramLabelEn: "—",
    topSectionLabelAr: "—",
    topSectionLabelEn: "—",
    goldMedalCount: 40,
    firstPlaceCount: 5,
    nominationCount: 80,
    highestLevelLabelAr: "—",
    highestLevelLabelEn: "—",
    internationalAchievementPct: 12,
    globalAchievementPct: 9,
  },
  charts: {
    genderParticipation: [],
    sectionParticipation: [],
    mawhibaSplit: [
      { key: "promising", labelAr: "واعد", labelEn: "Promising", count: 100 },
      { key: "yes", labelAr: "موهوب", labelEn: "Talented", count: 150 },
    ],
    resultDistribution: [],
    levelDistribution: [],
    genderResultStack: [],
    topPrograms: [],
    activityHorizontal: [],
    resultOutcomeCompare: [],
    yearTrend: [],
  },
  activityOptions: [],
  focusedActivity: null,
  tableTotal: 2,
  page: 1,
  pageSize: 500,
  table: [
    {
      activityKey: "oly",
      activityLabelAr: "أولمبياد فيزياء",
      activityLabelEn: "Physics Olympiad",
      typeKey: "oly",
      typeLabelAr: "أولمبياد",
      typeLabelEn: "Olympiad",
      classificationKey: "c",
      classificationLabelAr: "c",
      classificationLabelEn: "c",
      levelKey: "g10",
      levelLabelAr: "عاشر",
      levelLabelEn: "G10",
      participationResultKey: "nom",
      participationResultAr: "ترشيح",
      participationResultEn: "Nomination",
      totalParticipations: 60,
      distinctParticipants: 40,
      maleParticipants: 30,
      femaleParticipants: 30,
      arabicParticipants: 45,
      internationalParticipants: 15,
      mawhibaParticipants: 25,
      nonMawhibaParticipants: 35,
      goldMedalCount: 8,
      silverMedalCount: 4,
      bronzeMedalCount: 2,
      rankCount: 0,
      nominationCount: 30,
      participationOnlyCount: 10,
      approvedAchievements: 20,
      excellenceRatePct: 50,
    },
    {
      activityKey: "train",
      activityLabelAr: "تدريب مكثف",
      activityLabelEn: "Intensive training",
      typeKey: "train",
      typeLabelAr: "تدريب",
      typeLabelEn: "Training",
      classificationKey: "c",
      classificationLabelAr: "c",
      classificationLabelEn: "c",
      levelKey: "g9",
      levelLabelAr: "تاسع",
      levelLabelEn: "G9",
      participationResultKey: "part",
      participationResultAr: "مشاركة",
      participationResultEn: "Participation",
      totalParticipations: 100,
      distinctParticipants: 70,
      maleParticipants: 50,
      femaleParticipants: 50,
      arabicParticipants: 80,
      internationalParticipants: 20,
      mawhibaParticipants: 20,
      nonMawhibaParticipants: 80,
      goldMedalCount: 0,
      silverMedalCount: 0,
      bronzeMedalCount: 0,
      rankCount: 0,
      nominationCount: 10,
      participationOnlyCount: 80,
      approvedAchievements: 5,
      excellenceRatePct: 10,
    },
  ],
});

describe("educational-funnel-intelligence", () => {
  it("builds talent funnel with ordered stages", () => {
    const funnel = buildTalentFunnel(payload());
    expect(funnel.stages[0]?.key).toBe("promising");
    expect(funnel.stages.length).toBe(5);
    expect(funnel.metrics.stageConversion.length).toBe(4);
  });

  it("builds competition funnel success rate", () => {
    const funnel = buildCompetitionFunnel(payload());
    expect(funnel.stages[0]?.count).toBe(500);
    expect(funnel.successRate).toBeGreaterThanOrEqual(0);
  });

  it("builds all four funnel types", () => {
    invalidateStrategicCache();
    const all = buildAllEducationalFunnels(payload());
    expect(all.map((f) => f.type)).toEqual([
      "talent",
      "competition",
      "training",
      "standardized_testing",
    ]);
  });

  it("emits funnel narratives", () => {
    const narratives = buildFunnelNarratives(buildAllEducationalFunnels(payload()));
    expect(Array.isArray(narratives)).toBe(true);
  });
});
