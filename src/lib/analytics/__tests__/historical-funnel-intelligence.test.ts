import { describe, expect, it } from "vitest";
import {
  buildHistoricalFunnelIntelligence,
  buildStableEducationalFunnel,
  normalizeFunnelStages,
} from "@/lib/analytics/historical-funnel-intelligence";
import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";

const payload = (overrides?: Partial<ParticipationAnalyticsPayload["kpis"]>): ParticipationAnalyticsPayload => ({
  ok: true,
  generatedAt: "2026-01-01T00:00:00.000Z",
  filters: {},
  kpis: {
    totalParticipations: 100,
    distinctStudents: 50,
    mawhibaParticipationPct: 30,
    femalePct: 45,
    internationalSectionPct: 25,
    activeProgramsCount: 4,
    topProgramLabelAr: "—",
    topProgramLabelEn: "—",
    topSectionLabelAr: "—",
    topSectionLabelEn: "—",
    goldMedalCount: 8,
    firstPlaceCount: 2,
    nominationCount: 40,
    highestLevelLabelAr: "—",
    highestLevelLabelEn: "—",
    internationalAchievementPct: 15,
    globalAchievementPct: 10,
    ...overrides,
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
      activityKey: "maw",
      activityLabelAr: "موهبة",
      activityLabelEn: "Mawhiba",
      typeKey: "gifted",
      typeLabelAr: "c",
      typeLabelEn: "c",
      classificationKey: "c",
      classificationLabelAr: "c",
      classificationLabelEn: "c",
      levelKey: "g10",
      levelLabelAr: "عاشر",
      levelLabelEn: "G10",
      participationResultKey: "p",
      participationResultAr: "p",
      participationResultEn: "p",
      totalParticipations: 30,
      distinctParticipants: 25,
      maleParticipants: 15,
      femaleParticipants: 10,
      arabicParticipants: 25,
      internationalParticipants: 5,
      mawhibaParticipants: 30,
      nonMawhibaParticipants: 0,
      goldMedalCount: 2,
      silverMedalCount: 1,
      bronzeMedalCount: 0,
      rankCount: 20,
      nominationCount: 15,
      participationOnlyCount: 5,
      approvedAchievements: 12,
      excellenceRatePct: 40,
    },
  ],
  tableTotal: 1,
  page: 1,
  pageSize: 500,
});

describe("historical-funnel-intelligence", () => {
  it("returns insufficient narrative when years < 2", () => {
    const funnel = buildStableEducationalFunnel([{ year: 2024, payload: payload() }]);
    expect(funnel.sufficient).toBe(false);
    expect(funnel.narrativeAr).toContain("لا توجد بيانات كافية");
  });

  it("strongest transition is not ranked from ISEF terminal alone", () => {
    const funnel = buildStableEducationalFunnel([
      { year: 2022, payload: payload() },
      { year: 2024, payload: payload({ nominationCount: 50, totalParticipations: 120 }) },
    ]);
    if (!funnel.sufficient || !funnel.strongestTransition) return;
    expect(funnel.strongestTransition.to).not.toBe("international");
    expect(funnel.strongestTransition.retention).toBeGreaterThan(0);
    expect(funnel.strongestTransition.retention).toBeLessThanOrEqual(100);
  });

  it("normalizeFunnelStages produces monotonic pipeline", () => {
    const stages = normalizeFunnelStages({ year: 2024, payload: payload() });
    expect(stages.participation).toBeGreaterThanOrEqual(stages.acceptance);
    expect(stages.acceptance).toBeGreaterThanOrEqual(stages.international);
  });

  it("buildHistoricalFunnelIntelligence caches stable funnel", () => {
    const slices = [
      { year: 2022, payload: payload() },
      { year: 2024, payload: payload() },
    ];
    const a = buildHistoricalFunnelIntelligence(slices);
    const b = buildHistoricalFunnelIntelligence(slices);
    expect(a).not.toBeNull();
    expect(a?.sufficient).toBe(b?.sufficient);
  });
});
