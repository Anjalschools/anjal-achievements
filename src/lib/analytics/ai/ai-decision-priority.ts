import type { ExecutiveAiDecision, AiDecisionSeverity } from "@/lib/analytics/ai/ai-decision-schema";
import { compareAiDecisionSeverity } from "@/lib/analytics/ai/ai-decision-severity";
import { confidenceRank } from "@/lib/analytics/ai/ai-decision-confidence";

const impactScore = (impact: ExecutiveAiDecision["impact"]): number => {
  if (impact === "high") return 3;
  if (impact === "medium") return 2;
  return 1;
};

const urgencyScore = (u: ExecutiveAiDecision["urgency"]): number => {
  if (u === "high") return 3;
  if (u === "medium") return 2;
  return 1;
};

export const computeDecisionPriorityScore = (d: ExecutiveAiDecision): number => {
  const sev = compareAiDecisionSeverity(d.severity, "INFO");
  return (
    sev * 18 +
    impactScore(d.impact) * 12 +
    urgencyScore(d.urgency) * 10 +
    confidenceRank(d.confidence) * 6 +
    (d.historicalSupport ? 4 : 0)
  );
};

export const sortDecisionsByPriority = (decisions: ExecutiveAiDecision[]): ExecutiveAiDecision[] =>
  [...decisions].sort((a, b) => b.priorityScore - a.priorityScore);

export const partitionDecisionsByLayer = (
  decisions: ExecutiveAiDecision[]
): {
  topPriorities: ExecutiveAiDecision[];
  criticalRisks: ExecutiveAiDecision[];
  highImpactOpportunities: ExecutiveAiDecision[];
  recommendedActions: ExecutiveAiDecision[];
} => {
  const sorted = sortDecisionsByPriority(decisions);
  const topPriorities = sorted.filter(
    (d) => d.severity === "STRATEGIC_PRIORITY" || d.priorityScore >= 55
  ).slice(0, 6);
  const criticalRisks = sorted.filter(
    (d) => d.severity === "CRITICAL" || d.decisionType === "risk_mitigation"
  ).slice(0, 8);
  const highImpactOpportunities = sorted.filter(
    (d) =>
      d.decisionType === "opportunity" ||
      d.decisionType === "expansion" ||
      d.severity === "STRATEGIC_PRIORITY"
  ).slice(0, 8);
  const recommendedActions = sorted
    .flatMap((d) => d.suggestedActions.map((a) => ({ decision: d, action: a })))
    .slice(0, 12)
    .map((x) => x.decision);
  return {
    topPriorities,
    criticalRisks,
    highImpactOpportunities,
    recommendedActions: [...new Map(recommendedActions.map((d) => [d.id, d])).values()],
  };
};

export const maxSeverityInList = (decisions: ExecutiveAiDecision[]): AiDecisionSeverity => {
  let max: AiDecisionSeverity = "INFO";
  for (const d of decisions) {
    if (compareAiDecisionSeverity(d.severity, max) > 0) max = d.severity;
  }
  return max;
};
