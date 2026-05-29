import { describe, expect, it } from "vitest";
import {
  aggregateOutcomeMetricsFromRows,
  buildHistoricalOutcomeGraph,
  outcomeKindForMetricKey,
} from "@/lib/analytics/historical-outcome-model";
import type {
  ParticipationActivityRow,
  ParticipationAnalyticsPayload,
} from "@/lib/achievement-participation-analytics";

describe("historical-outcome-model", () => {
  it("classifies metric kinds", () => {
    expect(outcomeKindForMetricKey("gold")).toBe("medal");
    expect(outcomeKindForMetricKey("nomination")).toBe("qualification");
    expect(outcomeKindForMetricKey("rankings")).toBe("ranking");
  });

  it("builds outcome graph with strength score", () => {
    const slices = [
      {
        year: 2024,
        payload: {
          ok: true,
          generatedAt: "",
          filters: {},
          kpis: {} as ParticipationAnalyticsPayload["kpis"],
          charts: {} as ParticipationAnalyticsPayload["charts"],
          activityOptions: [],
          focusedActivity: null,
          table: [
            {
              activityKey: "b1",
              activityLabelEn: "Bebras",
              activityLabelAr: "بيبراس",
              typeKey: "bebras",
              typeLabelAr: "مسابقة",
              typeLabelEn: "Competition",
              classificationKey: "c",
              classificationLabelAr: "c",
              classificationLabelEn: "c",
              levelKey: "school",
              levelLabelAr: "مدرسة",
              levelLabelEn: "School",
              participationResultKey: "gold",
              participationResultAr: "ذهب",
              participationResultEn: "Gold",
              totalParticipations: 30,
              distinctParticipants: 28,
              maleParticipants: 15,
              femaleParticipants: 13,
              goldMedalCount: 4,
              silverMedalCount: 2,
              bronzeMedalCount: 1,
              nominationCount: 0,
              rankCount: 0,
              arabicParticipants: 25,
              internationalParticipants: 5,
              mawhibaParticipants: 2,
              nonMawhibaParticipants: 26,
              participationOnlyCount: 10,
              approvedAchievements: 0,
              excellenceRatePct: 50,
            } as ParticipationActivityRow,
          ],
          tableTotal: 1,
          page: 1,
          pageSize: 100,
        } as ParticipationAnalyticsPayload,
      },
    ];
    const graph = buildHistoricalOutcomeGraph("bebras", slices);
    expect(graph.signals.hasMedals).toBe(true);
    const m = aggregateOutcomeMetricsFromRows(slices[0]!.payload.table);
    expect(m.gold).toBe(4);
    expect(m.awardWinners).toBeGreaterThan(0);
  });
});
