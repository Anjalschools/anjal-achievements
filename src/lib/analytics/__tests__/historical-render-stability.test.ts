import { describe, expect, it } from "vitest";
import { buildStableHistoricalColumnLayout } from "@/lib/analytics/analytics-table-value-normalizer";
import { buildSafeHistoricalModel } from "@/lib/analytics/analytics-historical-table-validator";
import { buildHistoricalComparisonTable, ACTIVITY_FAMILIES } from "@/lib/analytics/historical-comparison-table-engine";
import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";

const payload = (): ParticipationAnalyticsPayload => ({
  ok: true,
  generatedAt: new Date().toISOString(),
  filters: {},
  kpis: {
    totalParticipations: 50,
    distinctStudents: 30,
    mawhibaParticipationPct: 10,
    femalePct: 50,
    internationalSectionPct: 20,
    activeProgramsCount: 2,
    topProgramLabelAr: "—",
    topProgramLabelEn: "—",
    topSectionLabelAr: "—",
    topSectionLabelEn: "—",
    goldMedalCount: 3,
    firstPlaceCount: 1,
    nominationCount: 2,
    highestLevelLabelAr: "—",
    highestLevelLabelEn: "—",
    internationalAchievementPct: 10,
    globalAchievementPct: 5,
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
      activityKey: "k-g7",
      activityLabelAr: "كانجارو",
      activityLabelEn: "Kangaroo",
      typeKey: "kangaroo",
      typeLabelAr: "c",
      typeLabelEn: "c",
      classificationKey: "c",
      classificationLabelAr: "c",
      classificationLabelEn: "c",
      levelKey: "g7",
      levelLabelAr: "سابع",
      levelLabelEn: "G7",
      participationResultKey: "gold",
      participationResultAr: "ذهب",
      participationResultEn: "Gold",
      totalParticipations: 15,
      distinctParticipants: 12,
      maleParticipants: 8,
      femaleParticipants: 4,
      arabicParticipants: 12,
      internationalParticipants: 3,
      mawhibaParticipants: 2,
      nonMawhibaParticipants: 10,
      goldMedalCount: 4,
      silverMedalCount: 2,
      bronzeMedalCount: 1,
      rankCount: 0,
      nominationCount: 0,
      participationOnlyCount: 8,
      approvedAchievements: 5,
      excellenceRatePct: 40,
    },
  ],
  tableTotal: 1,
  page: 1,
  pageSize: 500,
});

describe("historical-render-stability", () => {
  it("produces deterministic column layout from engine model", () => {
    const family = ACTIVITY_FAMILIES.find((f) => f.key === "kangaroo")!;
    const built = buildHistoricalComparisonTable({
      family,
      slices: [
        { year: 2022, payload: payload() },
        { year: 2024, payload: payload() },
      ],
    });
    expect(built).not.toBeNull();
    const safe = buildSafeHistoricalModel(built!);
    const layoutA = buildStableHistoricalColumnLayout(safe);
    const layoutB = buildStableHistoricalColumnLayout(safe);
    expect(layoutA.columns.map((c) => c.columnKey)).toEqual(
      layoutB.columns.map((c) => c.columnKey)
    );
    expect(layoutA.totalColumns).toBe(layoutB.totalColumns);
  });
});
