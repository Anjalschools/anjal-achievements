import type {
  AiDecisionConfidence,
  AiDecisionImpact,
  DecisionImpactSimulation,
  ExecutiveAiDecision,
} from "@/lib/analytics/ai/ai-decision-schema";

export const simulateDecisionImpact = (input: {
  decision: Pick<ExecutiveAiDecision, "decisionType" | "impact" | "urgency">;
  impact: AiDecisionImpact;
  confidence: AiDecisionConfidence;
}): DecisionImpactSimulation => {
  const base =
    input.impact === "high" ? 12
    : input.impact === "medium" ? 6
    : 3;

  const typeBoost =
    input.decision.decisionType === "participation_recovery" ? 8
    : input.decision.decisionType === "award_improvement" ? 10
    : input.decision.decisionType === "equity" ? 7
    : input.decision.decisionType === "expansion" ? 9
    : 4;

  const confScale =
    input.confidence === "HIGH" ? 1
    : input.confidence === "MEDIUM" ? 0.75
    : input.confidence === "LOW" ? 0.45
    : 0.3;

  const participation = Math.round((base + typeBoost) * confScale * 10) / 10;
  const awards = Math.round((base * 0.85 + typeBoost * 0.5) * confScale * 10) / 10;
  const qualification = Math.round((base * 0.6) * confScale * 10) / 10;
  const equity = input.decision.decisionType === "equity" ? Math.round(participation * 0.9 * 10) / 10 : Math.round(participation * 0.3 * 10) / 10;
  const riskReduction =
    input.decision.decisionType === "risk_mitigation" ? Math.round((base + 6) * confScale * 10) / 10 : Math.round(base * 0.4 * confScale * 10) / 10;

  const institutionalBenefitScore = Math.min(
    100,
    Math.round((participation + awards + equity + riskReduction) * 2.2)
  );

  return {
    expectedParticipationChangePct: participation,
    expectedAwardGrowthPct: awards,
    expectedQualificationGrowthPct: qualification,
    expectedEquityImpactPct: equity,
    expectedRiskReductionPct: riskReduction,
    confidenceBand:
      input.confidence === "HIGH" ? "narrow"
      : input.confidence === "MEDIUM" ? "moderate"
      : "wide",
    institutionalBenefitScore,
  };
};
