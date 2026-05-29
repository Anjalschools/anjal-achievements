import { describe, expect, it } from "vitest";
import { buildSafeMatrixModel } from "@/lib/analytics/historical-matrix-model";
import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";

const payload = (): ParticipationAnalyticsPayload => ({
  ok: true,
  generatedAt: "2026-01-01T00:00:00.000Z",
  filters: {},
  kpis: {
    totalParticipations: 40,
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

describe("historical-matrix-stability", () => {
  it("builds matrix with non-zero rows when data exists", () => {
    const { model, meta } = buildSafeMatrixModel([
      { year: 2023, payload: payload() },
      { year: 2024, payload: payload() },
    ]);
    expect(meta.valid).toBe(true);
    expect(model).not.toBeNull();
    expect(model!.rowLabels.length).toBeGreaterThan(0);
    expect(model!.columnLabels.length).toBeGreaterThan(0);
    const hasValue = model!.rowLabels.some((row) =>
      model!.columnLabels.some((col) => (model!.cells[row.key]?.[col.key] ?? 0) > 0)
    );
    expect(hasValue).toBe(true);
  });

  it("returns invalid meta for empty slices", () => {
    const { model, meta } = buildSafeMatrixModel([]);
    expect(model).toBeNull();
    expect(meta.valid).toBe(false);
  });
});
