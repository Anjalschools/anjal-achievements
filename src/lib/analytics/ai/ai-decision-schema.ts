/**
 * AI executive decision schema — deterministic, evidence-backed (no LLM hallucination).
 */

export type AiDecisionSeverity =
  | "INFO"
  | "WATCH"
  | "WARNING"
  | "CRITICAL"
  | "STRATEGIC_PRIORITY";

export type AiDecisionConfidence = "HIGH" | "MEDIUM" | "LOW" | "EXPLORATORY";

export type AiDecisionTimeHorizon = "immediate" | "short_term" | "medium_term" | "long_term";

export type AiDecisionType =
  | "expansion"
  | "intervention"
  | "equity"
  | "opportunity"
  | "risk_mitigation"
  | "talent_acceleration"
  | "competition_focus"
  | "strategic_growth"
  | "resource_allocation"
  | "participation_recovery"
  | "award_improvement"
  | "pipeline_repair"
  | "funnel_optimization";

export type AiDecisionImpact = "low" | "medium" | "high";

export type AiDecisionUrgency = "low" | "medium" | "high";

export type AiStrategicCategory =
  | "Participation"
  | "Equity"
  | "Talent"
  | "Competition"
  | "Awards"
  | "Risk"
  | "Growth"
  | "Execution";

export type SuggestedAction = {
  id: string;
  labelAr: string;
  labelEn: string;
  actionType: string;
  priority: number;
};

export type ExecutiveAiDecision = {
  id: string;
  title: string;
  titleAr: string;
  titleEn: string;
  executiveSummary: string;
  executiveSummaryAr: string;
  executiveSummaryEn: string;
  severity: AiDecisionSeverity;
  confidence: AiDecisionConfidence;
  urgency: AiDecisionUrgency;
  impact: AiDecisionImpact;
  evidence: string[];
  rationale: string;
  rationaleAr: string;
  rationaleEn: string;
  affectedDimensions: string[];
  suggestedActions: SuggestedAction[];
  expectedOutcome: string;
  expectedOutcomeAr: string;
  expectedOutcomeEn: string;
  strategicCategory: AiStrategicCategory;
  timeHorizon: AiDecisionTimeHorizon;
  decisionType: AiDecisionType;
  historicalSupport: boolean;
  generatedAt: string;
  sourceMetrics: string[];
  sourceInsights: string[];
  fingerprint: string;
  priorityScore: number;
  explainability?: AiDecisionExplainability;
  impactSimulation?: DecisionImpactSimulation;
};

export type AiDecisionExplainability = {
  whyCreatedAr: string;
  whyCreatedEn: string;
  supportingTrends: string[];
  filterScope: string;
  confidenceNoteAr: string;
  confidenceNoteEn: string;
  risksAr: string[];
  risksEn: string[];
  assumptionsAr: string[];
  assumptionsEn: string[];
  limitationsAr: string[];
  limitationsEn: string[];
};

export type DecisionImpactSimulation = {
  expectedParticipationChangePct: number;
  expectedAwardGrowthPct: number;
  expectedQualificationGrowthPct: number;
  expectedEquityImpactPct: number;
  expectedRiskReductionPct: number;
  confidenceBand: "narrow" | "moderate" | "wide";
  institutionalBenefitScore: number;
};

export type AiDecisionBundle = {
  generatedAt: string;
  filterFingerprint: string;
  decisions: ExecutiveAiDecision[];
  topPriorities: ExecutiveAiDecision[];
  criticalRisks: ExecutiveAiDecision[];
  highImpactOpportunities: ExecutiveAiDecision[];
  recommendedActions: ExecutiveAiDecision[];
  hasData: boolean;
};

export type StrategicActionPlan = {
  immediate: SuggestedAction[];
  shortTerm: SuggestedAction[];
  mediumTerm: SuggestedAction[];
  longTerm: SuggestedAction[];
  roadmap: Array<{
    phase: AiDecisionTimeHorizon;
    titleAr: string;
    titleEn: string;
    actions: SuggestedAction[];
  }>;
};

export type AiDecisionEngineResult = {
  bundle: AiDecisionBundle;
  actionPlan: StrategicActionPlan;
  boardSummary: ExecutiveBoardSummary;
};

export type ExecutiveBoardSummary = {
  headlineAr: string;
  headlineEn: string;
  topPriorityAr: string;
  topPriorityEn: string;
  greatestRiskAr: string;
  greatestRiskEn: string;
  bestInvestmentAr: string;
  bestInvestmentEn: string;
  resourceFocusAr: string;
  resourceFocusEn: string;
};
