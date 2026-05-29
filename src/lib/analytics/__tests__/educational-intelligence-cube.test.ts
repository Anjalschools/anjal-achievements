import { describe, expect, it } from "vitest";
import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";
import {
  buildIntelligenceCube,
  cubeCompare,
  cubeMetric,
  cubePivot,
  cubeRollup,
  cubeSlice,
} from "@/lib/analytics/educational-intelligence-cube";
import { invalidateStrategicCache } from "@/lib/analytics/analytics-strategic-cache";

const payload = (): ParticipationAnalyticsPayload => ({
  ok: true,
  generatedAt: new Date().toISOString(),
  filters: {},
  kpis: {
    totalParticipations: 200,
    distinctStudents: 80,
    mawhibaParticipationPct: 30,
    femalePct: 45,
    internationalSectionPct: 25,
    activeProgramsCount: 4,
    topProgramLabelAr: "A",
    topProgramLabelEn: "A",
    topSectionLabelAr: "عربي",
    topSectionLabelEn: "Arabic",
    goldMedalCount: 15,
    firstPlaceCount: 2,
    nominationCount: 40,
    highestLevelLabelAr: "—",
    highestLevelLabelEn: "—",
    internationalAchievementPct: 10,
    globalAchievementPct: 8,
  },
  charts: {
    genderParticipation: [
      { key: "male", labelAr: "بنين", labelEn: "Boys", count: 110 },
      { key: "female", labelAr: "بنات", labelEn: "Girls", count: 90 },
    ],
    sectionParticipation: [
      { key: "arabic", labelAr: "عربي", labelEn: "Arabic", count: 150 },
      { key: "international", labelAr: "دولي", labelEn: "Intl", count: 50 },
    ],
    mawhibaSplit: [{ key: "yes", labelAr: "موهبة", labelEn: "Mawhiba", count: 60 }],
    resultDistribution: [],
    levelDistribution: [],
    genderResultStack: [],
    topPrograms: [],
    activityHorizontal: [],
    resultOutcomeCompare: [],
    yearTrend: [
      { year: 2023, totalRows: 80, distinctStudents: 40, goldMedals: 5 },
      { year: 2024, totalRows: 120, distinctStudents: 55, goldMedals: 10 },
    ],
  },
  activityOptions: [],
  focusedActivity: null,
  tableTotal: 1,
  page: 1,
  pageSize: 500,
  table: [
    {
      activityKey: "kang",
      activityLabelAr: "كانجارو",
      activityLabelEn: "Kangaroo",
      typeKey: "comp",
      typeLabelAr: "مسابقة",
      typeLabelEn: "Competition",
      classificationKey: "c",
      classificationLabelAr: "c",
      classificationLabelEn: "c",
      levelKey: "g7",
      levelLabelAr: "سابع",
      levelLabelEn: "G7",
      participationResultKey: "gold",
      participationResultAr: "ذهب",
      participationResultEn: "Gold",
      totalParticipations: 120,
      distinctParticipants: 50,
      maleParticipants: 60,
      femaleParticipants: 60,
      arabicParticipants: 100,
      internationalParticipants: 20,
      mawhibaParticipants: 30,
      nonMawhibaParticipants: 90,
      goldMedalCount: 10,
      silverMedalCount: 5,
      bronzeMedalCount: 2,
      rankCount: 0,
      nominationCount: 20,
      participationOnlyCount: 50,
      approvedAchievements: 15,
      excellenceRatePct: 40,
    },
  ],
});

describe("educational-intelligence-cube", () => {
  it("builds cube with totals and cells", () => {
    invalidateStrategicCache();
    const cube = buildIntelligenceCube(payload());
    expect(cube.totals.participations).toBe(200);
    expect(cube.cells.length).toBeGreaterThan(0);
  });

  it("slices by dimension", () => {
    invalidateStrategicCache();
    const cube = buildIntelligenceCube(payload());
    const sliced = cubeSlice(cube, { gender: "male" });
    expect(sliced.cells.every((c) => !c.dimensions.gender || c.dimensions.gender === "male")).toBe(
      true
    );
  });

  it("pivots year vs gender when present", () => {
    const cube = buildIntelligenceCube(payload());
    const grid = cubePivot(cube, "year", "gender");
    expect(typeof grid).toBe("object");
  });

  it("rollup aggregates cells", () => {
    const cube = buildIntelligenceCube(payload());
    const rolled = cubeRollup(cube);
    expect(rolled.participations).toBeGreaterThan(0);
  });

  it("cubeMetric reads registry", () => {
    const cube = buildIntelligenceCube(payload());
    expect(cubeMetric(cube, "participation_count")).toBe(200);
  });

  it("cubeCompare deltas two cubes", () => {
    const a = buildIntelligenceCube(payload());
    const b = buildIntelligenceCube({
      ...payload(),
      kpis: { ...payload().kpis, totalParticipations: 250 },
    });
    const cmp = cubeCompare(a, b, "participation_count");
    expect(cmp.delta).toBe(50);
  });
});
