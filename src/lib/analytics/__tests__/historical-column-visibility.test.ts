import { describe, expect, it } from "vitest";
import { buildHistoricalComparisonTable } from "@/lib/analytics/historical-comparison-table-engine";
import { ACTIVITY_FAMILIES } from "@/lib/analytics/historical-comparison-table-engine";
import { applyDynamicColumnVisibility } from "@/lib/analytics/historical-dynamic-column-visibility";
import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";

const payload = (): ParticipationAnalyticsPayload => ({
  ok: true,
  generatedAt: "",
  filters: {},
  kpis: { totalParticipations: 50 } as ParticipationAnalyticsPayload["kpis"],
  charts: {} as ParticipationAnalyticsPayload["charts"],
  activityOptions: [],
  focusedActivity: null,
  table: [
    {
      activityLabelAr: "كانجارو",
      activityLabelEn: "Kangaroo",
      typeKey: "kangaroo",
      totalParticipations: 50,
      goldMedalCount: 0,
      silverMedalCount: 0,
      bronzeMedalCount: 0,
      nominationCount: 0,
      approvedAchievements: 0,
      rankCount: 0,
      levelKey: "g7",
      arabicParticipants: 40,
      internationalParticipants: 10,
    } as ParticipationAnalyticsPayload["table"][number],
  ],
  tableTotal: 1,
  page: 1,
  pageSize: 100,
});

describe("historical-column-visibility", () => {
  it("hides gold column when no medals across years", () => {
    const family = ACTIVITY_FAMILIES.find((f) => f.key === "kangaroo")!;
    const raw = buildHistoricalComparisonTable({
      family,
      slices: [
        { year: 2023, payload: payload() },
        { year: 2024, payload: payload() },
      ],
      displayMode: "executive",
    });
    expect(raw).not.toBeNull();
    const visible = applyDynamicColumnVisibility(raw!, "executive");
    const keys = visible.yearGroups.flatMap((g) => g.metrics.map((m) => m.key));
    expect(keys).not.toContain("gold");
    expect(keys).toContain("participation");
  });
});
