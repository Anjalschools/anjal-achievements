import type {
  AiDecisionImpact,
  AiDecisionType,
  AiDecisionUrgency,
  AiStrategicCategory,
  AiDecisionTimeHorizon,
  ExecutiveAiDecision,
  SuggestedAction,
} from "@/lib/analytics/ai/ai-decision-schema";
import type { EducationalRecommendation } from "@/lib/analytics/analytics-recommendation-engine";
import type { ExecutiveSemanticInsight } from "@/lib/analytics/intelligence/analytics-narrative-schema";
import type { AnalyticsInsight } from "@/lib/analytics/analytics-insights-engine";
import { mapInsightSeverityToDecision, mapRecommendationSeverity } from "@/lib/analytics/ai/ai-decision-severity";
import { confidenceFromNumeric } from "@/lib/analytics/ai/ai-decision-confidence";
import { decisionContentFingerprint } from "@/lib/analytics/ai/ai-decision-fingerprint";
import { buildDecisionExplainability, applyExplainabilityGuardrails } from "@/lib/analytics/ai/ai-decision-explainer";
import { computeDecisionPriorityScore } from "@/lib/analytics/ai/ai-decision-priority";
import { simulateDecisionImpact } from "@/lib/analytics/ai/decision-impact-simulator";

const recTypeToDecision = (t: EducationalRecommendation["type"]): AiDecisionType => {
  if (t === "expansion") return "expansion";
  if (t === "equity") return "equity";
  if (t === "talent-discovery") return "talent_acceleration";
  if (t === "concentration-reduction") return "resource_allocation";
  if (t === "access-improvement") return "participation_recovery";
  return "intervention";
};

const categoryFromType = (t: AiDecisionType): AiStrategicCategory => {
  if (t === "equity") return "Equity";
  if (t === "talent_acceleration") return "Talent";
  if (t === "competition_focus") return "Competition";
  if (t === "award_improvement") return "Awards";
  if (t === "risk_mitigation") return "Risk";
  if (t === "expansion" || t === "strategic_growth") return "Growth";
  return "Execution";
};

export const normalizeFromRecommendation = (
  rec: EducationalRecommendation,
  filterScope: string
): ExecutiveAiDecision => {
  const decisionType = recTypeToDecision(rec.type);
  const severity = mapRecommendationSeverity(rec.severity);
  const confidence = confidenceFromNumeric(rec.confidence / 100);
  const impact: AiDecisionImpact =
    rec.opportunityImpact >= 70 ? "high" : rec.opportunityImpact >= 40 ? "medium" : "low";
  const urgency: AiDecisionUrgency =
    rec.urgency === "high" ? "high" : rec.urgency === "medium" ? "medium" : "low";

  const suggestedActions: SuggestedAction[] = [
    {
      id: `${rec.id}-act-1`,
      labelAr: rec.bodyAr.slice(0, 120),
      labelEn: rec.bodyEn.slice(0, 120),
      actionType: rec.type,
      priority: rec.priority,
    },
  ];

  const partial: Omit<ExecutiveAiDecision, "explainability" | "impactSimulation" | "priorityScore" | "fingerprint"> = {
    id: `dec-rec-${rec.id}`,
    title: rec.titleAr,
    titleAr: rec.titleAr,
    titleEn: rec.titleEn,
    executiveSummary: rec.bodyAr,
    executiveSummaryAr: rec.bodyAr,
    executiveSummaryEn: rec.bodyEn,
    severity,
    confidence,
    urgency,
    impact,
    evidence: rec.trace.triggeringMetrics,
    rationale: rec.reasonAr,
    rationaleAr: rec.reasonAr,
    rationaleEn: rec.reasonEn,
    affectedDimensions: rec.trace.demographicBasis,
    suggestedActions,
    expectedOutcome: rec.trace.confidenceExplanationAr,
    expectedOutcomeAr: rec.trace.confidenceExplanationAr,
    expectedOutcomeEn: rec.trace.confidenceExplanationEn,
    strategicCategory: categoryFromType(decisionType),
    timeHorizon: urgency === "high" ? "immediate" : urgency === "medium" ? "short_term" : "medium_term",
    decisionType,
    historicalSupport: false,
    generatedAt: new Date().toISOString(),
    sourceMetrics: rec.trace.triggeringMetrics,
    sourceInsights: [rec.id],
  };

  const fingerprint = decisionContentFingerprint({
    decisionType,
    titleEn: rec.titleEn,
    sourceInsights: partial.sourceInsights,
  });

  const base: ExecutiveAiDecision = {
    ...partial,
    fingerprint,
    priorityScore: 0,
    explainability: buildDecisionExplainability({
      decision: { ...partial, fingerprint, priorityScore: 0 },
      filterScope,
      confidence,
    }),
    impactSimulation: simulateDecisionImpact({ decision: partial, impact, confidence }),
  };
  base.priorityScore = computeDecisionPriorityScore(base);
  return applyExplainabilityGuardrails(base);
};

export const normalizeFromSemanticInsight = (
  ins: ExecutiveSemanticInsight,
  filterScope: string
): ExecutiveAiDecision => {
  const decisionType: AiDecisionType =
    ins.intelligenceCategory === "Equity" ? "equity"
    : ins.severity === "OPPORTUNITY" ? "opportunity"
    : ins.severity === "WARNING" || ins.severity === "CRITICAL" ? "risk_mitigation"
    : "intervention";

  const severity = mapInsightSeverityToDecision(ins.severity);
  const confidence = ins.confidence;
  const impact: AiDecisionImpact =
    ins.impact === "high" ? "high" : ins.impact === "medium" ? "medium" : "low";
  const urgency: AiDecisionUrgency = impact === "high" ? "high" : "medium";

  const partial: Omit<ExecutiveAiDecision, "explainability" | "impactSimulation" | "priorityScore" | "fingerprint"> = {
    id: `dec-ins-${ins.id}`,
    title: ins.titleAr,
    titleAr: ins.titleAr,
    titleEn: ins.titleEn,
    executiveSummary: ins.descriptionAr,
    executiveSummaryAr: ins.descriptionAr,
    executiveSummaryEn: ins.descriptionEn,
    severity,
    confidence,
    urgency,
    impact,
    evidence: ins.evidence,
    rationale: ins.strategicMeaning,
    rationaleAr: ins.strategicMeaning,
    rationaleEn: ins.descriptionEn,
    affectedDimensions: ins.affectedDimensions,
    suggestedActions: ins.recommendation
      ? [
          {
            id: `${ins.id}-act`,
            labelAr: ins.recommendation,
            labelEn: ins.recommendation,
            actionType: decisionType,
            priority: 50,
          },
        ]
      : [],
    expectedOutcome: ins.strategicMeaning,
    expectedOutcomeAr: ins.strategicMeaning,
    expectedOutcomeEn: ins.descriptionEn,
    strategicCategory: categoryFromType(decisionType),
    timeHorizon: ins.historicalSupport ? "medium_term" : "short_term",
    decisionType,
    historicalSupport: Boolean(ins.historicalSupport),
    generatedAt: new Date().toISOString(),
    sourceMetrics: ins.affectedDimensions,
    sourceInsights: [ins.id],
  };

  const fingerprint = decisionContentFingerprint({
    decisionType,
    titleEn: ins.titleEn,
    sourceInsights: partial.sourceInsights,
  });

  const base: ExecutiveAiDecision = {
    ...partial,
    fingerprint,
    priorityScore: 0,
    explainability: buildDecisionExplainability({
      decision: { ...partial, fingerprint, priorityScore: 0 },
      filterScope,
      confidence,
    }),
    impactSimulation: simulateDecisionImpact({ decision: partial, impact, confidence }),
  };
  base.priorityScore = computeDecisionPriorityScore(base);
  return applyExplainabilityGuardrails(base);
};

export const normalizeFromAnalyticsInsight = (
  ins: AnalyticsInsight,
  filterScope: string
): ExecutiveAiDecision | null => {
  if (ins.severity === "info") return null;
  const decisionType: AiDecisionType =
    ins.id.includes("equity") ? "equity"
    : ins.id.includes("year") ? "strategic_growth"
    : "risk_mitigation";

  const severity = mapInsightSeverityToDecision(ins.severity === "warn" ? "WARNING" : "CRITICAL");
  const confidence = confidenceFromNumeric(ins.confidence);
  const impact: AiDecisionImpact = ins.severity === "critical" ? "high" : "medium";

  const partial: Omit<ExecutiveAiDecision, "explainability" | "impactSimulation" | "priorityScore" | "fingerprint"> = {
    id: `dec-alert-${ins.id}`,
    title: ins.titleAr,
    titleAr: ins.titleAr,
    titleEn: ins.titleEn,
    executiveSummary: ins.bodyAr,
    executiveSummaryAr: ins.bodyAr,
    executiveSummaryEn: ins.bodyEn,
    severity,
    confidence,
    urgency: ins.severity === "critical" ? "high" : "medium",
    impact,
    evidence: ins.metricKeys,
    rationale: ins.bodyAr,
    rationaleAr: ins.bodyAr,
    rationaleEn: ins.bodyEn,
    affectedDimensions: ins.metricKeys,
    suggestedActions: [],
    expectedOutcome: ins.bodyEn,
    expectedOutcomeAr: ins.bodyAr,
    expectedOutcomeEn: ins.bodyEn,
    strategicCategory: categoryFromType(decisionType),
    timeHorizon: "immediate",
    decisionType,
    historicalSupport: false,
    generatedAt: new Date().toISOString(),
    sourceMetrics: ins.metricKeys,
    sourceInsights: [ins.id],
  };

  const fingerprint = decisionContentFingerprint({
    decisionType,
    titleEn: ins.titleEn,
    sourceInsights: partial.sourceInsights,
  });

  const base: ExecutiveAiDecision = {
    ...partial,
    fingerprint,
    priorityScore: computeDecisionPriorityScore({ ...partial, fingerprint, priorityScore: 0 } as ExecutiveAiDecision),
    explainability: buildDecisionExplainability({
      decision: { ...partial, fingerprint, priorityScore: 0 },
      filterScope,
      confidence,
    }),
    impactSimulation: simulateDecisionImpact({ decision: partial, impact, confidence }),
  };
  return applyExplainabilityGuardrails(base);
};
