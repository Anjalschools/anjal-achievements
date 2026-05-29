import { describe, expect, it } from "vitest";
import { injectOutcomeMeasuresIntoSlices } from "@/lib/analytics/historical-outcome-measure-injector";
import { buildCellsFromOutcomeMeasures } from "@/lib/analytics/historical-outcome-row-builder";
import { getSmartResultsMetrics } from "@/lib/analytics/historical-smart-results-table";
import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";

describe("historical-outcome-row-builder", () => {
  it("builds cells with medals not only participation", () => {
    const { slices } = injectOutcomeMeasuresIntoSlices(
      [
        {
          year: 2024,
          payload: {
            ok: true,
            generatedAt: "",
            filters: {},
            kpis: { totalParticipations: 15 } as ParticipationAnalyticsPayload["kpis"],
            charts: {} as ParticipationAnalyticsPayload["charts"],
            activityOptions: [],
            focusedActivity: null,
            table: [
              {
                activityLabelEn: "Kangaroo",
                activityLabelAr: "كانجارو",
                typeKey: "kangaroo",
                totalParticipations: 15,
                goldMedalCount: 4,
                silverMedalCount: 1,
                bronzeMedalCount: 0,
                nominationCount: 0,
                rankCount: 0,
                levelKey: "school",
                arabicParticipants: 12,
                internationalParticipants: 3,
              },
            ],
            tableTotal: 1,
            page: 1,
            pageSize: 100,
          } as unknown as ParticipationAnalyticsPayload,
        },
      ],
      "kangaroo",
      "medals"
    );
    const metrics = getSmartResultsMetrics("medals");
    const cells = buildCellsFromOutcomeMeasures(slices, [
      { year: 2024, labelAr: "2024", labelEn: "2024", metrics },
    ]);
    expect(cells["2024__participation"]).toBe(15);
    expect(cells["2024__gold"]).toBe(4);
    expect(cells["2024__award_winners"]).toBe(5);
  });
});
