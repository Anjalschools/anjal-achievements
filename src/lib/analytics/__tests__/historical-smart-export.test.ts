import { describe, expect, it } from "vitest";
import { polishHistoricalTableModel } from "@/lib/analytics/historical-table-polish";
import { buildHistoricalComparisonTable } from "@/lib/analytics/historical-comparison-table-engine";
import { ACTIVITY_FAMILIES } from "@/lib/analytics/historical-comparison-table-engine";
import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";

describe("historical-smart-export", () => {
  it("polished model has no zero-only medal columns", () => {
    const family = ACTIVITY_FAMILIES.find((f) => f.key === "kangaroo")!;
    const raw = buildHistoricalComparisonTable({
      family,
      slices: [
        {
          year: 2024,
          payload: {
            ok: true,
            generatedAt: "",
            filters: {},
            kpis: { totalParticipations: 30 } as ParticipationAnalyticsPayload["kpis"],
            charts: {} as ParticipationAnalyticsPayload["charts"],
            activityOptions: [],
            focusedActivity: null,
            table: [
              {
                activityLabelAr: "كانجارو",
                activityLabelEn: "Kangaroo",
                typeKey: "kangaroo",
                totalParticipations: 30,
                goldMedalCount: 0,
                silverMedalCount: 0,
                bronzeMedalCount: 0,
                nominationCount: 0,
                levelKey: "school",
                arabicParticipants: 25,
                internationalParticipants: 5,
              } as ParticipationAnalyticsPayload["table"][number],
            ],
            tableTotal: 1,
            page: 1,
            pageSize: 100,
          },
        },
      ],
    });
    const polished = polishHistoricalTableModel(raw!, "executive");
    const keys = polished.yearGroups.flatMap((g) => g.metrics.map((m) => m.key));
    expect(keys).not.toContain("silver");
  });
});
