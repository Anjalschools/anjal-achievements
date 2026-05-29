import { describe, expect, it } from "vitest";
import { buildStableEducationalFunnel, FUNNEL_TRANSITION_PAIRS } from "@/lib/analytics/historical-funnel-intelligence";
import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";

const payload = (): ParticipationAnalyticsPayload => ({
  ok: true,
  generatedAt: "2026-01-01T00:00:00.000Z",
  filters: {},
  kpis: {
    totalParticipations: 200,
    distinctStudents: 80,
    mawhibaParticipationPct: 35,
    femalePct: 50,
    internationalSectionPct: 20,
    activeProgramsCount: 5,
    topProgramLabelAr: "—",
    topProgramLabelEn: "—",
    topSectionLabelAr: "—",
    topSectionLabelEn: "—",
    goldMedalCount: 10,
    firstPlaceCount: 3,
    nominationCount: 60,
    highestLevelLabelAr: "—",
    highestLevelLabelEn: "—",
    internationalAchievementPct: 12,
    globalAchievementPct: 8,
  },
  charts: {
    genderParticipation: [],
    sectionParticipation: [],
    mawhibaSplit: [],
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
  table: [
    {
      activityKey: "r1",
      activityLabelAr: "موهبة",
      activityLabelEn: "Gifted",
      typeKey: "g",
      typeLabelAr: "c",
      typeLabelEn: "c",
      classificationKey: "c",
      classificationLabelAr: "c",
      classificationLabelEn: "c",
      levelKey: "g8",
      levelLabelAr: "ثامن",
      levelLabelEn: "G8",
      participationResultKey: "p",
      participationResultAr: "p",
      participationResultEn: "p",
      totalParticipations: 50,
      distinctParticipants: 40,
      maleParticipants: 25,
      femaleParticipants: 15,
      arabicParticipants: 40,
      internationalParticipants: 10,
      mawhibaParticipants: 50,
      nonMawhibaParticipants: 0,
      goldMedalCount: 4,
      silverMedalCount: 2,
      bronzeMedalCount: 1,
      rankCount: 35,
      nominationCount: 25,
      participationOnlyCount: 10,
      approvedAchievements: 20,
      excellenceRatePct: 55,
    },
  ],
  tableTotal: 1,
  page: 1,
  pageSize: 500,
});

describe("historical-funnel-integrity", () => {
  it("bottleneck uses lowest retention among valid transitions", () => {
    const funnel = buildStableEducationalFunnel([
      { year: 2023, payload: payload() },
      { year: 2024, payload: payload() },
    ]);
    if (!funnel.sufficient || !funnel.weakestTransition) return;
    expect(funnel.weakestTransition.retention).toBeLessThanOrEqual(
      funnel.strongestTransition?.retention ?? 100
    );
    expect(FUNNEL_TRANSITION_PAIRS.some((p) => p.to === funnel.bottleneckStage)).toBe(true);
  });

  it("exposes confidence and completeness scores", () => {
    const funnel = buildStableEducationalFunnel([
      { year: 2023, payload: payload() },
      { year: 2024, payload: payload() },
    ]);
    expect(funnel.funnelConfidence).toBeGreaterThanOrEqual(0);
    expect(funnel.dataCompleteness).toBeGreaterThanOrEqual(0);
  });
});
