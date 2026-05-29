import { describe, expect, it } from "vitest";
import {
  buildUnifiedAggregationGraph,
  graphHasMetricSignal,
} from "@/lib/analytics/historical-unified-aggregation-graph";
import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";

describe("historical-unified-aggregation-graph", () => {
  it("builds totals with medal signal", () => {
    const graph = buildUnifiedAggregationGraph(
      [
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
                activityLabelEn: "Bebras",
                activityLabelAr: "بيبراس",
                typeKey: "bebras",
                totalParticipations: 30,
                goldMedalCount: 3,
                silverMedalCount: 1,
                bronzeMedalCount: 0,
                nominationCount: 0,
                rankCount: 0,
                levelKey: "school",
                arabicParticipants: 25,
                internationalParticipants: 5,
              },
            ],
            tableTotal: 1,
            page: 1,
            pageSize: 100,
          } as unknown as ParticipationAnalyticsPayload,
        },
      ],
      "bebras",
      "medals"
    );
    expect(graph.totals.gold_medals).toBe(3);
    expect(graph.signals.hasMedals).toBe(true);
    expect(graphHasMetricSignal(graph, "gold")).toBe(true);
  });
});
