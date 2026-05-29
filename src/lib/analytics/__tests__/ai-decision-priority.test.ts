import { describe, expect, it } from "vitest";
import { computeDecisionPriorityScore, sortDecisionsByPriority } from "@/lib/analytics/ai/ai-decision-priority";
import type { ExecutiveAiDecision } from "@/lib/analytics/ai/ai-decision-schema";

const stub = (partial: Partial<ExecutiveAiDecision>): ExecutiveAiDecision =>
  ({
    id: "x",
    title: "t",
    titleAr: "t",
    titleEn: "t",
    executiveSummary: "",
    executiveSummaryAr: "",
    executiveSummaryEn: "",
    severity: "INFO",
    confidence: "MEDIUM",
    urgency: "low",
    impact: "low",
    evidence: [],
    rationale: "",
    rationaleAr: "",
    rationaleEn: "",
    affectedDimensions: [],
    suggestedActions: [],
    expectedOutcome: "",
    expectedOutcomeAr: "",
    expectedOutcomeEn: "",
    strategicCategory: "Execution",
    timeHorizon: "short_term",
    decisionType: "intervention",
    historicalSupport: false,
    generatedAt: "",
    sourceMetrics: [],
    sourceInsights: [],
    fingerprint: "fp",
    priorityScore: 0,
    ...partial,
  }) as ExecutiveAiDecision;

describe("ai-decision-priority", () => {
  it("ranks critical above info", () => {
    const a = stub({ severity: "INFO", priorityScore: computeDecisionPriorityScore(stub({ severity: "INFO" })) });
    const b = stub({
      severity: "CRITICAL",
      priorityScore: computeDecisionPriorityScore(stub({ severity: "CRITICAL", impact: "high" })),
    });
    const sorted = sortDecisionsByPriority([a, b]);
    expect(sorted[0]!.severity).toBe("CRITICAL");
  });
});
