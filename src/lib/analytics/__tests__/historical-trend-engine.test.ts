import { describe, expect, it } from "vitest";
import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";
import {
  buildHistoricalTrendAnalysis,
  computeTrendIndicators,
  resolveTrendSemantic,
} from "@/lib/analytics/historical-trend-engine";
import { invalidateStrategicCache } from "@/lib/analytics/analytics-strategic-cache";

const basePayload = (participations: number, year: number): ParticipationAnalyticsPayload => ({
  ok: true,
  generatedAt: new Date().toISOString(),
  filters: {},
  kpis: {
    totalParticipations: participations,
    distinctStudents: Math.round(participations * 0.4),
    mawhibaParticipationPct: 20,
    femalePct: 50,
    internationalSectionPct: 20,
    activeProgramsCount: 3,
    topProgramLabelAr: "—",
    topProgramLabelEn: "—",
    topSectionLabelAr: "—",
    topSectionLabelEn: "—",
    goldMedalCount: Math.round(participations * 0.1),
    firstPlaceCount: 1,
    nominationCount: Math.round(participations * 0.2),
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
  table: [],
  tableTotal: 0,
  page: 1,
  pageSize: 500,
});

describe("historical-trend-engine", () => {
  it("computes CAGR for growing series", () => {
    const series = [
      { year: 2021, value: 100 },
      { year: 2022, value: 130 },
      { year: 2023, value: 160 },
      { year: 2024, value: 200 },
    ];
    const indicators = computeTrendIndicators(series);
    expect(indicators.cagr).toBeGreaterThan(0);
    expect(["accelerating", "emerging_growth"]).toContain(resolveTrendSemantic(indicators));
  });

  it("builds analysis from year slices", () => {
    invalidateStrategicCache();
    const slices = [
      { year: 2022, payload: basePayload(80, 2022) },
      { year: 2023, payload: basePayload(120, 2023) },
      { year: 2024, payload: basePayload(180, 2024) },
    ];
    const analysis = buildHistoricalTrendAnalysis(slices, "participation_count");
    expect(analysis.series).toHaveLength(3);
    expect(analysis.narratives.length).toBeGreaterThan(0);
    expect(analysis.indicators.cagr).toBeGreaterThan(0);
  });

  it("detects declining semantic", () => {
    const series = [
      { year: 2021, value: 200 },
      { year: 2022, value: 150 },
      { year: 2023, value: 100 },
      { year: 2024, value: 60 },
    ];
    const indicators = computeTrendIndicators(series);
    expect(resolveTrendSemantic(indicators)).toBe("declining");
  });
});
