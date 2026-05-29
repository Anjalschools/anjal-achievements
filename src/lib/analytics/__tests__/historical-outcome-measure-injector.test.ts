import { describe, expect, it } from "vitest";
import { injectOutcomeMeasuresIntoSlices } from "@/lib/analytics/historical-outcome-measure-injector";
import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";

const slice = (gold: number): { year: number; payload: ParticipationAnalyticsPayload } => ({
  year: 2024,
  payload: {
    ok: true,
    generatedAt: "",
    filters: {},
    kpis: { totalParticipations: 20, goldMedalCount: gold } as ParticipationAnalyticsPayload["kpis"],
    charts: {
      resultOutcomeCompare: [
        { key: "gold", labelAr: "ذهب", labelEn: "Gold", count: gold, color: "#fbbf24" },
      ],
    } as ParticipationAnalyticsPayload["charts"],
    activityOptions: [],
    focusedActivity: null,
    table: [
      {
        activityLabelAr: "كانجارو",
        activityLabelEn: "Kangaroo",
        typeKey: "kangaroo",
        totalParticipations: 20,
        goldMedalCount: gold,
        silverMedalCount: 0,
        bronzeMedalCount: 0,
        nominationCount: 2,
        rankCount: 1,
        levelKey: "school",
        arabicParticipants: 18,
        internationalParticipants: 2,
      } as ParticipationAnalyticsPayload["table"][number],
    ],
    tableTotal: 1,
    page: 1,
    pageSize: 100,
  },
});

describe("historical-outcome-measure-injector", () => {
  it("injects full outcome measures per year", () => {
    const { slices, unifiedGraph } = injectOutcomeMeasuresIntoSlices(
      [slice(5)],
      "kangaroo",
      "medals"
    );
    expect(slices[0]!.injectedMeasures.participants).toBe(20);
    expect(slices[0]!.injectedMeasures.gold_medals).toBe(5);
    expect(slices[0]!.injectedMeasures.award_winners).toBe(5);
    expect(unifiedGraph.signals.hasMedals).toBe(true);
  });
});
