import { describe, expect, it } from "vitest";
import { buildHistoricalResultsDebugReport } from "@/lib/analytics/historical-results-debugger";
import { buildUnifiedAggregationGraph } from "@/lib/analytics/historical-unified-aggregation-graph";
import type { HistoricalComparisonTableModel } from "@/lib/analytics/historical-comparison-table-engine";

describe("historical-results-debugger", () => {
  it("reports totals from unified graph", () => {
    const graph = buildUnifiedAggregationGraph(
      [
        {
          year: 2024,
          payload: {
            ok: true,
            generatedAt: "",
            filters: {},
            kpis: { totalParticipations: 10 } as never,
            charts: {} as never,
            activityOptions: [],
            focusedActivity: null,
            table: [
              {
                activityLabelEn: "Kangaroo",
                activityLabelAr: "كانجارو",
                typeKey: "kangaroo",
                totalParticipations: 10,
                goldMedalCount: 2,
                silverMedalCount: 0,
                bronzeMedalCount: 0,
                nominationCount: 0,
                rankCount: 0,
                levelKey: "school",
                arabicParticipants: 8,
                internationalParticipants: 2,
              } as never,
            ],
            tableTotal: 1,
            page: 1,
            pageSize: 100,
          },
        },
      ],
      "kangaroo",
      "medals"
    );
    const model = {
      tableType: "medals",
      yearGroups: [{ year: 2024, labelAr: "y", labelEn: "y", metrics: [{ key: "gold", labelAr: "g", labelEn: "g" }] }],
      rows: [{ key: "t", labelAr: "t", labelEn: "t", cells: { "2024__gold": 2 } }],
      unifiedGraph: graph,
    } as unknown as HistoricalComparisonTableModel;
    const report = buildHistoricalResultsDebugReport(graph, model);
    expect(report.totals.gold_medals).toBe(2);
  });
});
