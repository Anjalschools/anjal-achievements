import { describe, expect, it } from "vitest";
import { buildExecutiveCellHighlights } from "@/lib/analytics/historical-executive-highlighting";
import { buildHistoricalComparisonTable } from "@/lib/analytics/historical-comparison-table-engine";
import { ACTIVITY_FAMILIES } from "@/lib/analytics/historical-comparison-table-engine";
import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";

const slice = (year: number, part: number): { year: number; payload: ParticipationAnalyticsPayload } => ({
  year,
  payload: {
    ok: true,
    generatedAt: "",
    filters: {},
    kpis: { totalParticipations: part } as ParticipationAnalyticsPayload["kpis"],
    charts: {} as ParticipationAnalyticsPayload["charts"],
    activityOptions: [],
    focusedActivity: null,
    table: [
      {
        activityLabelAr: "كانجارو",
        activityLabelEn: "Kangaroo",
        typeKey: "kangaroo",
        totalParticipations: part,
        goldMedalCount: 2,
        silverMedalCount: 0,
        bronzeMedalCount: 0,
        nominationCount: 3,
        levelKey: "school",
        arabicParticipants: part,
        internationalParticipants: 0,
      } as ParticipationAnalyticsPayload["table"][number],
    ],
    tableTotal: 1,
    page: 1,
    pageSize: 100,
  },
});

describe("historical-executive-highlighting", () => {
  it("marks peak participation year", () => {
    const family = ACTIVITY_FAMILIES.find((f) => f.key === "kangaroo")!;
    const table = buildHistoricalComparisonTable({
      family,
      slices: [slice(2022, 10), slice(2024, 80)],
    });
    expect(table).not.toBeNull();
    const h = buildExecutiveCellHighlights(table!);
    const kinds = Object.values(h);
    expect(
      kinds.some((v) => v === "peak_year" || v === "growth" || v === "best_rate")
    ).toBe(true);
  });
});
