import { describe, expect, it } from "vitest";
import { buildHistoricalAlerts } from "@/lib/analytics/historical-alert-engine";
import type { HistoricalTrendIntelligence } from "@/lib/analytics/historical-trend-intelligence";

const trend = (
  overrides: Partial<HistoricalTrendIntelligence>
): HistoricalTrendIntelligence => ({
  scope: { kind: "activity", key: "sat", labelAr: "SAT", labelEn: "SAT" },
  metricId: "participation_count",
  series: [
    { year: 2021, value: 80 },
    { year: 2022, value: 60 },
    { year: 2023, value: 40 },
    { year: 2024, value: 25 },
  ],
  cagr: -20,
  rollingGrowth: -15,
  momentum: -10,
  acceleration: -5,
  deceleration: 5,
  volatility: 30,
  stability: 50,
  recoveryRate: 0,
  peaks: {
    bestYear: 2021,
    worstYear: 2024,
    largestJumpYear: 2021,
    largestDropYear: 2023,
    mostStableYear: 2022,
    inflectionYear: 2022,
    bestValue: 80,
    worstValue: 25,
  },
  consistency: {
    overall: 40,
    stability: 45,
    sustainability: 35,
    growthQuality: 30,
    volatilityResistance: 40,
    labelAr: "متوسط",
    labelEn: "Moderate",
  },
  semantic: "declining",
  ...overrides,
});

describe("historical-alert-engine", () => {
  it("emits critical sustained decline", () => {
    const alerts = buildHistoricalAlerts({ trends: [trend({})] });
    expect(alerts.some((a) => a.code === "sustained_decline")).toBe(true);
    expect(alerts[0]?.severity).toMatch(/critical|warning/);
  });

  it("emits funnel leakage alert", () => {
    const alerts = buildHistoricalAlerts({
      trends: [],
      funnel: {
        sufficient: true,
        snapshots: [],
        strongestTransition: {
          key: "participation_training",
          from: "participation",
          to: "training",
          sourceCount: 50,
          targetCount: 40,
          conversionRate: 80,
          retention: 80,
          leakageRate: 20,
          valid: true,
        },
        weakestTransition: {
          key: "qualification_award",
          from: "qualification",
          to: "award",
          sourceCount: 30,
          targetCount: 6,
          conversionRate: 20,
          retention: 20,
          leakageRate: 80,
          valid: true,
        },
        bottleneckStage: "acceptance",
        bottleneckSeverity: 80,
        funnelLeakage: 60,
        yoyQualityDelta: -5,
        funnelConfidence: 70,
        dataCompleteness: 80,
        funnelTerminationReason: "complete",
        narrativeAr: "تسرب",
        narrativeEn: "Leakage",
      },
    });
    expect(alerts.some((a) => a.code === "funnel_leakage")).toBe(true);
  });
});
