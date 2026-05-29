import { describe, expect, it } from "vitest";
import { buildCompetitionResultsSummary } from "@/lib/analytics/historical-results-summary";
import { buildHistoricalComparisonTable } from "@/lib/analytics/historical-comparison-table-engine";
import { ACTIVITY_FAMILIES } from "@/lib/analytics/historical-comparison-table-engine";
import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";

const payload = (): ParticipationAnalyticsPayload => ({
  ok: true,
  generatedAt: "",
  filters: {},
  kpis: { totalParticipations: 80, nominationCount: 10 } as ParticipationAnalyticsPayload["kpis"],
  charts: {} as ParticipationAnalyticsPayload["charts"],
  activityOptions: [],
  focusedActivity: null,
  table: [
    {
      activityLabelAr: "كانجارو",
      activityLabelEn: "Kangaroo",
      typeKey: "kangaroo",
      totalParticipations: 40,
      goldMedalCount: 3,
      silverMedalCount: 1,
      bronzeMedalCount: 0,
      nominationCount: 0,
      approvedAchievements: 0,
      rankCount: 0,
      mawhibaParticipants: 0,
      participationOnlyCount: 0,
      excellenceRatePct: 0,
      levelKey: "school",
      arabicParticipants: 30,
      internationalParticipants: 10,
    } as ParticipationAnalyticsPayload["table"][number],
  ],
  tableTotal: 1,
  page: 1,
  pageSize: 120,
});

describe("historical-results-summary", () => {
  it("builds peak participation year", () => {
    const family = ACTIVITY_FAMILIES.find((f) => f.key === "kangaroo")!;
    const table = buildHistoricalComparisonTable({
      family,
      slices: [
        { year: 2023, payload: payload() },
        { year: 2024, payload: { ...payload(), kpis: { ...payload().kpis, totalParticipations: 120 } } },
      ],
    });
    const summary = buildCompetitionResultsSummary(
      [
        { year: 2023, payload: payload() },
        { year: 2024, payload: { ...payload(), kpis: { ...payload().kpis, totalParticipations: 120 } } },
      ],
      table ? [table] : []
    );
    expect(summary.peakParticipationYear).toBe(2024);
  });
});
