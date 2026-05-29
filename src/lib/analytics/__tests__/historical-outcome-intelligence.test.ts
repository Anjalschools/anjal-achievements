import { describe, expect, it } from "vitest";
import { buildHistoricalOutcomeIntelligence } from "@/lib/analytics/historical-outcome-intelligence";
import { buildHistoricalComparisonTable } from "@/lib/analytics/historical-comparison-table-engine";
import { ACTIVITY_FAMILIES } from "@/lib/analytics/historical-comparison-table-engine";
import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";

const p = (): ParticipationAnalyticsPayload => ({
  ok: true,
  generatedAt: "",
  filters: {},
  kpis: { totalParticipations: 100 } as ParticipationAnalyticsPayload["kpis"],
  charts: {} as ParticipationAnalyticsPayload["charts"],
  activityOptions: [],
  focusedActivity: null,
  table: [
    {
      activityLabelAr: "كانجارو",
      activityLabelEn: "Kangaroo",
      typeKey: "kangaroo",
      totalParticipations: 40,
      goldMedalCount: 4,
      silverMedalCount: 2,
      bronzeMedalCount: 1,
      nominationCount: 10,
      levelKey: "school",
      arabicParticipants: 30,
      internationalParticipants: 10,
    } as ParticipationAnalyticsPayload["table"][number],
  ],
  tableTotal: 1,
  page: 1,
  pageSize: 100,
});

describe("historical-outcome-intelligence", () => {
  it("computes competitive strength score", () => {
    const family = ACTIVITY_FAMILIES.find((f) => f.key === "kangaroo")!;
    const table = buildHistoricalComparisonTable({
      family,
      slices: [
        { year: 2023, payload: p() },
        { year: 2024, payload: p() },
      ],
    });
    expect(table).not.toBeNull();
    const outcome = buildHistoricalOutcomeIntelligence(
      [
        { year: 2023, payload: p() },
        { year: 2024, payload: p() },
      ],
      table!
    );
    expect(outcome.overall).toBeGreaterThan(0);
    expect(outcome.awardDensity).toBeGreaterThan(0);
  });
});
