import { describe, expect, it } from "vitest";
import { prioritizeRecommendations } from "@/lib/analytics/recommendation-prioritization";
import type { EducationalRecommendation } from "@/lib/analytics/analytics-recommendation-engine";

const rec = (
  id: string,
  severity: EducationalRecommendation["severity"],
  priority: number
): EducationalRecommendation => ({
  id,
  type: "participation",
  uiCategory: "participation",
  severity,
  urgency: "high",
  confidence: 0.8,
  opportunityImpact: 70,
  equityImpact: 60,
  titleAr: id,
  titleEn: id,
  bodyAr: "",
  bodyEn: "",
  reasonAr: "",
  reasonEn: "",
  targetCohortAr: "",
  targetCohortEn: "",
  supportingMetrics: [],
  priority,
  trace: {
    recommendationId: id,
    sourceDatasets: ["charts"],
    triggeringMetrics: [],
    demographicBasis: [],
    opportunityFactors: [],
    confidenceExplanationAr: "",
    confidenceExplanationEn: "",
    perspective: "participation",
  },
  drillSource: "section_bar",
  drillPayload: {},
});

describe("recommendation-prioritization", () => {
  it("returns top 3 executive recommendations by severity", () => {
    const bundle = prioritizeRecommendations([
      rec("a", "info", 10),
      rec("b", "critical", 90),
      rec("c", "high", 80),
      rec("d", "moderate", 50),
      rec("e", "critical", 85),
    ]);
    expect(bundle.executiveTop3).toHaveLength(3);
    expect(bundle.executiveTop3[0]!.severity).toBe("critical");
    expect(bundle.byTier.critical_actions.length).toBeGreaterThan(0);
  });

  it("groups recommendations into clusters", () => {
    const bundle = prioritizeRecommendations([
      rec("p1", "high", 70),
      { ...rec("e1", "moderate", 40), uiCategory: "equity", type: "equity" },
    ]);
    expect(bundle.clusters.length).toBeGreaterThanOrEqual(1);
  });
});
