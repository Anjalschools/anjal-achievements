/**
 * Academic opportunity recommendations — explainable, eligibility-gated.
 */

import type { ExecutiveAiDecision } from "@/lib/analytics/ai/ai-decision-schema";
import { confidenceFromNumeric } from "@/lib/analytics/ai/ai-decision-confidence";
import { computeDecisionPriorityScore } from "@/lib/analytics/ai/ai-decision-priority";
import { applyExplainabilityGuardrails } from "@/lib/analytics/ai/ai-decision-explainer";
import type {
  CompetitionOpportunityVerdict,
  StudentOpportunityProfile,
} from "@/lib/analytics/ai/opportunity-intelligence/opportunity-types";
import { topOpportunities } from "@/lib/analytics/ai/opportunity-intelligence/ai-opportunity-priority";

const verdictToExecutiveDecision = (
  verdict: CompetitionOpportunityVerdict,
  studentId: string
): ExecutiveAiDecision => {
  const exploratory = verdict.confidence < 0.75;
  const confidence = confidenceFromNumeric(verdict.confidence, exploratory);

  const severity =
    verdict.decision === "RECOMMENDED" ? "STRATEGIC_PRIORITY"
    : verdict.decision === "HIGH_POTENTIAL" ? "WARNING"
    : verdict.decision === "FUTURE_OPPORTUNITY" ? "WATCH"
    : verdict.decision === "BLOCKED" ? "INFO"
    : "INFO";

  const partial: ExecutiveAiDecision = {
    id: `opp-${studentId}-${verdict.competitionKey}`,
    title: verdict.titleAr,
    titleAr: verdict.titleAr,
    titleEn: verdict.titleEn,
    executiveSummary: verdict.reasonsAr.join(" · "),
    executiveSummaryAr: verdict.reasonsAr.join(" · "),
    executiveSummaryEn: verdict.reasonsEn.join(" · "),
    severity,
    confidence,
    urgency: verdict.priority === "critical" ? "high" : verdict.priority === "high" ? "medium" : "low",
    impact: verdict.matchScore >= 70 ? "high" : verdict.matchScore >= 45 ? "medium" : "low",
    evidence: verdict.factors.map((f) => `${f.key}:${Math.round(f.weight * 100)}`),
    rationale: `Opportunity ${verdict.decision} — readiness ${verdict.readinessScore}`,
    rationaleAr: `قرار فرصة: ${verdict.decision} — جاهزية ${verdict.readinessScore}/100`,
    rationaleEn: `Opportunity: ${verdict.decision} — readiness ${verdict.readinessScore}/100`,
    affectedDimensions: [studentId, verdict.competitionKey, verdict.decision],
    suggestedActions: [
      {
        id: `act-${verdict.competitionKey}`,
        labelAr: `مراجعة أهلية ${verdict.titleAr}`,
        labelEn: `Review ${verdict.titleEn} eligibility`,
        actionType: "opportunity",
        priority: verdict.matchScore,
      },
    ],
    expectedOutcome: `Match score ${verdict.matchScore}/100`,
    expectedOutcomeAr: `ملاءمة ${verdict.matchScore}/100`,
    expectedOutcomeEn: `Match ${verdict.matchScore}/100`,
    strategicCategory: "Talent",
    timeHorizon:
      verdict.timeHorizon === "now" ? "immediate"
      : verdict.timeHorizon === "next_year" ? "short_term"
      : "medium_term",
    decisionType: "opportunity",
    historicalSupport: verdict.readinessScore >= 50,
    generatedAt: new Date().toISOString(),
    sourceMetrics: [`readiness:${verdict.readinessScore}`, `match:${verdict.matchScore}`],
    sourceInsights: [`opportunity:${verdict.decision}`],
    fingerprint: `opp-${studentId}-${verdict.competitionKey}-${verdict.decision}`,
    priorityScore: 0,
  };
  partial.priorityScore = computeDecisionPriorityScore(partial);
  return applyExplainabilityGuardrails(partial);
};

export const buildOpportunityExecutiveDecisions = (
  profile: StudentOpportunityProfile,
  opts?: { maxDecisions?: number; includeBlocked?: boolean }
): ExecutiveAiDecision[] => {
  const max = opts?.maxDecisions ?? 8;
  const top = topOpportunities(
    [
      ...profile.recommendedCompetitions,
      ...profile.eligibleCompetitions,
      ...profile.futureOpportunities,
    ],
    max
  );

  const decisions = top.map((v) => verdictToExecutiveDecision(v, profile.participantId));

  if (opts?.includeBlocked) {
    const blocked = profile.blockedCompetitions.slice(0, 3).map((v) =>
      verdictToExecutiveDecision(v, profile.participantId)
    );
    return [...decisions, ...blocked].slice(0, max + 3);
  }

  return decisions;
};

export const buildCounselorRecommendations = (
  profile: StudentOpportunityProfile
): Array<{ titleAr: string; titleEn: string; bodyAr: string; bodyEn: string; priority: number }> =>
  profile.pathwayRecommendations.map((p) => ({
    titleAr: p.titleAr,
    titleEn: p.titleEn,
    bodyAr: p.rationaleAr,
    bodyEn: p.rationaleEn,
    priority: p.priority === "critical" ? 95 : p.priority === "high" ? 80 : 60,
  }));
