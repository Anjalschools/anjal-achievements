import { describe, expect, it } from "vitest";
import {
  buildCompetitionMatrix,
  buildDemographicParticipationInsights,
  buildActivityDemographicBreakdowns,
} from "@/lib/analytics/analytics-demographic-intelligence";
import type {
  ParticipationActivityRow,
  ParticipationAnalyticsPayload,
} from "@/lib/achievement-participation-analytics";

const sampleRow = (overrides: Partial<ParticipationActivityRow> = {}): ParticipationActivityRow =>
  ({
    activityKey: "bebras",
    activityLabelAr: "بيبراس",
    activityLabelEn: "Bebras",
    typeKey: "competition",
    typeLabelAr: "مسابقة",
    typeLabelEn: "Competition",
    classificationKey: "sci",
    classificationLabelAr: "علمي",
    classificationLabelEn: "Science",
    levelKey: "g9",
    levelLabelAr: "الصف التاسع",
    levelLabelEn: "Grade 9",
    participationResultKey: "medal",
    participationResultAr: "ميدالية",
    participationResultEn: "Medal",
    totalParticipations: 50,
    distinctParticipants: 40,
    maleParticipants: 30,
    femaleParticipants: 20,
    arabicParticipants: 35,
    internationalParticipants: 15,
    mawhibaParticipants: 25,
    nonMawhibaParticipants: 25,
    goldMedalCount: 2,
    silverMedalCount: 1,
    bronzeMedalCount: 1,
    rankCount: 0,
    nominationCount: 0,
    participationOnlyCount: 46,
    approvedAchievements: 4,
    excellenceRatePct: 8,
    ...overrides,
  }) as ParticipationActivityRow;

const samplePayload = (table: ParticipationActivityRow[]): ParticipationAnalyticsPayload =>
  ({
    ok: true,
    generatedAt: new Date().toISOString(),
    filters: {} as never,
    kpis: {
      totalParticipations: table.reduce((s, r) => s + r.totalParticipations, 0),
      distinctStudents: 40,
      goldMedalCount: 2,
      internationalAchievementPct: 0,
      internationalSectionPct: 30,
    },
    charts: {
      sectionParticipation: [
        { key: "arabic", labelAr: "عربي", labelEn: "Arabic", count: 35 },
        { key: "intl", labelAr: "دولي", labelEn: "International", count: 15 },
      ],
      genderParticipation: [
        { key: "male", labelAr: "بنين", labelEn: "Boys", count: 30 },
        { key: "female", labelAr: "بنات", labelEn: "Girls", count: 20 },
      ],
      mawhibaSplit: [
        { key: "yes", labelAr: "موهبة", labelEn: "Mawhiba", count: 25 },
        { key: "no", labelAr: "غير موهبة", labelEn: "Non-Mawhiba", count: 25 },
      ],
      levelDistribution: [
        { labelAr: "الصف التاسع", labelEn: "Grade 9", count: 50 },
      ],
      genderResultStack: [],
      activityHorizontal: [],
      yearTrend: [],
      resultOutcomeCompare: [],
      resultDistribution: [],
    },
    table,
    tableTotal: table.length,
    tablePage: 1,
    tablePageSize: 25,
    activityOptions: [],
  }) as unknown as ParticipationAnalyticsPayload;

describe("analytics-demographic-intelligence", () => {
  it("builds competition matrix with density and conversion", () => {
    const matrix = buildCompetitionMatrix([sampleRow()], 5);
    expect(matrix).toHaveLength(1);
    expect(matrix[0]?.participations).toBe(50);
    expect(matrix[0]?.students).toBe(40);
    expect(matrix[0]?.density).toBeGreaterThan(1);
    expect(matrix[0]?.conversionPct).toBeGreaterThan(0);
  });

  it("surfaces demographic participation insights", () => {
    const insights = buildDemographicParticipationInsights(
      samplePayload([sampleRow()]),
      [sampleRow()],
      true
    );
    expect(insights.length).toBeGreaterThan(0);
    expect(insights.some((i) => i.id === "top_activity_participation")).toBe(true);
  });

  it("breaks down activity demographics by section and gender", () => {
    const breakdowns = buildActivityDemographicBreakdowns([sampleRow()], 3);
    expect(breakdowns[0]?.bySection.arabic).toBe(35);
    expect(breakdowns[0]?.byGender.male).toBe(30);
  });
});
