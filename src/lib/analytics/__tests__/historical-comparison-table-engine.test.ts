import { describe, expect, it } from "vitest";
import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";
import {
  ACTIVITY_FAMILIES,
  buildHistoricalComparisonTable,
  buildHistoricalTrends,
} from "@/lib/analytics/historical-comparison-table-engine";
import { ROW_CATEGORIES } from "@/lib/analytics/shared/historical-row-categories";

const emptyPayload = (): ParticipationAnalyticsPayload => ({
  ok: true,
  generatedAt: new Date().toISOString(),
  filters: {},
  kpis: {
    totalParticipations: 100,
    distinctStudents: 50,
    mawhibaParticipationPct: 40,
    femalePct: 45,
    internationalSectionPct: 30,
    activeProgramsCount: 5,
    topProgramLabelAr: "—",
    topProgramLabelEn: "—",
    topSectionLabelAr: "—",
    topSectionLabelEn: "—",
    goldMedalCount: 10,
    firstPlaceCount: 2,
    nominationCount: 5,
    highestLevelLabelAr: "—",
    highestLevelLabelEn: "—",
    internationalAchievementPct: 20,
    globalAchievementPct: 15,
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
      activityKey: "kang-g7",
      activityLabelAr: "كانجارو",
      activityLabelEn: "Kangaroo",
      typeKey: "kangaroo",
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
      totalParticipations: 20,
      distinctParticipants: 18,
      maleParticipants: 10,
      femaleParticipants: 8,
      arabicParticipants: 15,
      internationalParticipants: 5,
      mawhibaParticipants: 4,
      nonMawhibaParticipants: 14,
      goldMedalCount: 5,
      silverMedalCount: 3,
      bronzeMedalCount: 2,
      rankCount: 0,
      nominationCount: 0,
      participationOnlyCount: 10,
      approvedAchievements: 10,
      excellenceRatePct: 50,
    },
  ],
  tableTotal: 1,
  page: 1,
  pageSize: 500,
});

describe("historical-comparison-table-engine", () => {
  it("builds medal table with year groups", () => {
    const family = ACTIVITY_FAMILIES.find((f) => f.key === "kangaroo")!;
    const model = buildHistoricalComparisonTable({
      family,
      slices: [
        { year: 2023, payload: emptyPayload() },
        { year: 2024, payload: emptyPayload() },
      ],
    });
    expect(model).not.toBeNull();
    expect(model!.yearGroups).toHaveLength(2);
    expect(model!.rows.length).toBeGreaterThan(0);
    expect(ROW_CATEGORIES.length).toBe(6);
  });

  it("computes trend chips across years", () => {
    const rows = [
      {
        key: "middle_ar",
        cells: { "2023__participation": 10, "2024__participation": 25 },
      },
    ];
    const trends = buildHistoricalTrends(
      [
        {
          year: 2023,
          labelAr: "2023",
          labelEn: "2023",
          metrics: [{ key: "participation", labelAr: "مشاركة", labelEn: "Participation" }],
        },
        {
          year: 2024,
          labelAr: "2024",
          labelEn: "2024",
          metrics: [{ key: "participation", labelAr: "مشاركة", labelEn: "Participation" }],
        },
      ],
      rows
    );
    expect(trends.some((t) => t.direction === "up")).toBe(true);
  });
});
