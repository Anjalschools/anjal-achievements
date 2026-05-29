import { describe, expect, it } from "vitest";
import { buildHistoricalTablesWithFallback } from "@/lib/analytics/historical-fallback-strategies";
import type { HistoricalYearSlice } from "@/lib/analytics/historical-comparison-fetch";

const exploratorySlice = (): HistoricalYearSlice => ({
  year: 2023,
  payload: {
    ok: true,
    generatedAt: "",
    filters: {},
    kpis: { totalParticipations: 12 } as HistoricalYearSlice["payload"]["kpis"],
    charts: {} as HistoricalYearSlice["payload"]["charts"],
    activityOptions: [],
    focusedActivity: null,
    table: [
      {
        activityLabelAr: "كانجارو",
        activityLabelEn: "Kangaroo Math",
        typeKey: "kangaroo",
        totalParticipations: 12,
        goldMedalCount: 0,
        nominationCount: 0,
        approvedAchievements: 0,
        rankCount: 0,
      } as HistoricalYearSlice["payload"]["table"][number],
    ],
    tableTotal: 1,
    page: 1,
    pageSize: 500,
  },
});

describe("historical-fallback-strategies", () => {
  it("returns exploratory tables when strict path is empty", () => {
    const result = buildHistoricalTablesWithFallback({
      slices: [exploratorySlice(), { ...exploratorySlice(), year: 2024 }],
    });
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.strategy).toBe("STRICT");
    expect(result.fallbackConfidence).toBeGreaterThan(0);
  });
});
