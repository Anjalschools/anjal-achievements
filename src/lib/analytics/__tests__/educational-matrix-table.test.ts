import { describe, expect, it } from "vitest";
import { buildEducationalMatrixTable } from "@/lib/analytics/historical-comparison-table-engine";
import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";

const payload: ParticipationAnalyticsPayload = {
  ok: true,
  generatedAt: "",
  filters: {},
  kpis: {
    totalParticipations: 1,
    distinctStudents: 1,
    mawhibaParticipationPct: 0,
    femalePct: 0,
    internationalSectionPct: 0,
    activeProgramsCount: 0,
    topProgramLabelAr: "",
    topProgramLabelEn: "",
    topSectionLabelAr: "",
    topSectionLabelEn: "",
    goldMedalCount: 0,
    firstPlaceCount: 0,
    nominationCount: 0,
    highestLevelLabelAr: "",
    highestLevelLabelEn: "",
    internationalAchievementPct: 0,
    globalAchievementPct: 0,
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
      activityKey: "b",
      activityLabelAr: "بيبراس",
      activityLabelEn: "Bebras",
      typeKey: "bebras",
      typeLabelAr: "",
      typeLabelEn: "",
      classificationKey: "",
      classificationLabelAr: "",
      classificationLabelEn: "",
      levelKey: "g8",
      levelLabelAr: "",
      levelLabelEn: "",
      participationResultKey: "",
      participationResultAr: "",
      participationResultEn: "",
      totalParticipations: 8,
      distinctParticipants: 8,
      maleParticipants: 4,
      femaleParticipants: 4,
      arabicParticipants: 8,
      internationalParticipants: 0,
      mawhibaParticipants: 0,
      nonMawhibaParticipants: 8,
      goldMedalCount: 1,
      silverMedalCount: 0,
      bronzeMedalCount: 0,
      rankCount: 0,
      nominationCount: 0,
      participationOnlyCount: 7,
      approvedAchievements: 1,
      excellenceRatePct: 10,
    },
  ],
  tableTotal: 1,
  page: 1,
  pageSize: 500,
};

describe("educational-matrix-table", () => {
  it("builds cross-activity matrix for latest year", () => {
    const matrix = buildEducationalMatrixTable([{ year: 2024, payload }]);
    expect(matrix).not.toBeNull();
    expect(matrix!.columnLabels.some((c) => c.key === "bebras")).toBe(true);
    expect(matrix!.cells.middle_ar?.bebras).toBeGreaterThan(0);
  });
});
