import { describe, expect, it } from "vitest";
import { buildExecutiveBoardSummary } from "@/lib/analytics/ai/executive-board-summary";
import type { AiDecisionBundle } from "@/lib/analytics/ai/ai-decision-schema";

describe("executive-board-summary", () => {
  it("builds headline from priorities", () => {
    const bundle: AiDecisionBundle = {
      generatedAt: "",
      filterFingerprint: "fp",
      decisions: [],
      topPriorities: [
        {
          id: "1",
          title: "t",
          titleAr: "قرار",
          titleEn: "Decision",
          executiveSummary: "",
          executiveSummaryAr: "ملخص",
          executiveSummaryEn: "Summary",
          severity: "STRATEGIC_PRIORITY",
          confidence: "HIGH",
          urgency: "high",
          impact: "high",
          evidence: [],
          rationale: "",
          rationaleAr: "",
          rationaleEn: "",
          affectedDimensions: [],
          suggestedActions: [],
          expectedOutcome: "",
          expectedOutcomeAr: "",
          expectedOutcomeEn: "",
          strategicCategory: "Growth",
          timeHorizon: "immediate",
          decisionType: "expansion",
          historicalSupport: false,
          generatedAt: "",
          sourceMetrics: [],
          sourceInsights: [],
          fingerprint: "f",
          priorityScore: 90,
        },
      ],
      criticalRisks: [],
      highImpactOpportunities: [],
      recommendedActions: [],
      hasData: true,
    };
    const s = buildExecutiveBoardSummary(bundle);
    expect(s.headlineAr).toContain("قرار");
  });
});
