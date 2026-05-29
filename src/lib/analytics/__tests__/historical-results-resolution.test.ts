import { describe, expect, it } from "vitest";
import {
  buildResultsFingerprint,
  detectHistoricalOutcomeGapFromUnified,
  resolveHistoricalOutcomeGraph,
  resolveMetricFromRows,
} from "@/lib/analytics/historical-results-resolution-engine";
import { buildUnifiedAggregationGraph } from "@/lib/analytics/historical-unified-aggregation-graph";
import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";

const payload = (year: number, gold: number, part: number): ParticipationAnalyticsPayload => ({
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
      goldMedalCount: gold,
      silverMedalCount: 0,
      bronzeMedalCount: 0,
      nominationCount: 0,
      rankCount: 0,
      levelKey: "school",
      arabicParticipants: part,
      internationalParticipants: 0,
    } as ParticipationAnalyticsPayload["table"][number],
  ],
  tableTotal: 1,
  page: 1,
  pageSize: 100,
});

describe("historical-results-resolution", () => {
  it("aggregates medals from outcome graph", () => {
    const slices = [
      { year: 2023, payload: payload(2023, 5, 40) },
      { year: 2024, payload: payload(2024, 2, 35) },
    ];
    const graph = resolveHistoricalOutcomeGraph("kangaroo", slices);
    expect(graph.signals.hasMedals).toBe(true);
    expect(graph.signals.hasParticipation).toBe(true);
    const totalGold = graph.nodes.reduce((s, n) => s + n.metrics.gold, 0);
    expect(totalGold).toBe(7);
  });

  it("detects participation without awards gap", () => {
    const slices = [{ year: 2024, payload: payload(2024, 0, 50) }];
    const unified = buildUnifiedAggregationGraph(slices, "kangaroo", "medals");
    const gap = detectHistoricalOutcomeGapFromUnified(unified);
    expect(gap.hasParticipation).toBe(true);
    expect(gap.hasAwardData).toBe(false);
    expect(gap.messageAr).toContain("لا توجد بيانات نتائج/تتويج مرتبطة");
  });

  it("stable results fingerprint", () => {
    const slices = [{ year: 2024, payload: payload(2024, 3, 20) }];
    expect(buildResultsFingerprint("kangaroo", slices)).toBe(
      buildResultsFingerprint("kangaroo", slices)
    );
  });

  it("resolves ranking metric", () => {
    const rows = payload(2024, 1, 10).table;
    const withRank = [{ ...rows[0]!, rankCount: 4 }];
    expect(resolveMetricFromRows(withRank, "rankings")).toBe(4);
  });
});
