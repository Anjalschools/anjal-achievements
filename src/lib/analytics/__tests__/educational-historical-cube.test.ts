import { describe, expect, it } from "vitest";
import {
  buildEducationalHistoricalCube,
  queryHistoricalCube,
} from "@/lib/analytics/educational-historical-cube";
import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";

const payload = (): ParticipationAnalyticsPayload => ({
  ok: true,
  generatedAt: new Date().toISOString(),
  filters: {},
  kpis: {
    totalParticipations: 30,
    distinctStudents: 20,
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
    nominationCount: 5,
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
      participationResultKey: "p",
      participationResultAr: "p",
      participationResultEn: "p",
      totalParticipations: 15,
      distinctParticipants: 12,
      maleParticipants: 8,
      femaleParticipants: 4,
      arabicParticipants: 12,
      internationalParticipants: 3,
      mawhibaParticipants: 2,
      nonMawhibaParticipants: 10,
      goldMedalCount: 2,
      silverMedalCount: 1,
      bronzeMedalCount: 0,
      rankCount: 0,
      nominationCount: 0,
      participationOnlyCount: 10,
      approvedAchievements: 5,
      excellenceRatePct: 40,
    },
  ],
  tableTotal: 1,
  page: 1,
  pageSize: 500,
});

describe("educational-historical-cube", () => {
  it("builds cube cells across years", () => {
    const cube = buildEducationalHistoricalCube([
      { year: 2023, payload: payload() },
      { year: 2024, payload: payload() },
    ]);
    expect(cube.years).toEqual([2023, 2024]);
    expect(cube.cells.length).toBeGreaterThan(0);
    expect(cube.totals.participation).toBeGreaterThan(0);
  });

  it("queries by activity dimension", () => {
    const cube = buildEducationalHistoricalCube([
      { year: 2024, payload: payload() },
    ]);
    const kang = queryHistoricalCube(cube, { activity: "kangaroo" });
    expect(kang.length).toBeGreaterThan(0);
  });
});
