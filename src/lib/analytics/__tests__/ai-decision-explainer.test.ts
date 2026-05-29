import { describe, expect, it } from "vitest";
import { buildDecisionExplainability, applyExplainabilityGuardrails } from "@/lib/analytics/ai/ai-decision-explainer";
import type { ExecutiveAiDecision } from "@/lib/analytics/ai/ai-decision-schema";

describe("ai-decision-explainer", () => {
  it("adds exploratory disclaimer for low confidence", () => {
    const d: ExecutiveAiDecision = {
      id: "1",
      title: "t",
      titleAr: "عنوان",
      titleEn: "Title",
      executiveSummary: "s",
      executiveSummaryAr: "ملخص",
      executiveSummaryEn: "summary",
      severity: "CRITICAL",
      confidence: "EXPLORATORY",
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
      strategicCategory: "Risk",
      timeHorizon: "immediate",
      decisionType: "risk_mitigation",
      historicalSupport: false,
      generatedAt: "",
      sourceMetrics: [],
      sourceInsights: [],
      fingerprint: "fp",
      priorityScore: 10,
    };
    const guarded = applyExplainabilityGuardrails(d);
    expect(guarded.executiveSummaryEn).toContain("Exploratory");
    const exp = buildDecisionExplainability({ decision: d, filterScope: "test", confidence: "LOW" });
    expect(exp?.limitationsEn.length).toBeGreaterThan(0);
  });
});
