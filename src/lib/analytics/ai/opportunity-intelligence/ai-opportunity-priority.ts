/**
 * Prioritize opportunity verdicts for counselors and executive views.
 */

import type {
  CompetitionOpportunityVerdict,
  OpportunityDecisionKind,
  OpportunityPriority,
} from "@/lib/analytics/ai/opportunity-intelligence/opportunity-types";

const DECISION_RANK: Record<OpportunityDecisionKind, number> = {
  RECOMMENDED: 5,
  HIGH_POTENTIAL: 4,
  FUTURE_OPPORTUNITY: 3,
  ELIGIBLE: 2,
  NOT_RECOMMENDED: 1,
  BLOCKED: 0,
};

const PRIORITY_RANK: Record<OpportunityPriority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export const compareOpportunityVerdicts = (
  a: CompetitionOpportunityVerdict,
  b: CompetitionOpportunityVerdict
): number => {
  const dr = DECISION_RANK[b.decision] - DECISION_RANK[a.decision];
  if (dr !== 0) return dr;
  const pr = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
  if (pr !== 0) return pr;
  if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
  return b.confidence - a.confidence;
};

export const sortOpportunitiesByPriority = (
  verdicts: CompetitionOpportunityVerdict[]
): CompetitionOpportunityVerdict[] => [...verdicts].sort(compareOpportunityVerdicts);

export const topOpportunities = (
  verdicts: CompetitionOpportunityVerdict[],
  limit = 5
): CompetitionOpportunityVerdict[] =>
  sortOpportunitiesByPriority(
    verdicts.filter(
      (v) =>
        v.decision === "RECOMMENDED" ||
        v.decision === "HIGH_POTENTIAL" ||
        v.decision === "FUTURE_OPPORTUNITY"
    )
  ).slice(0, limit);

export const blockedOpportunities = (
  verdicts: CompetitionOpportunityVerdict[]
): CompetitionOpportunityVerdict[] =>
  verdicts.filter((v) => v.decision === "BLOCKED").sort(compareOpportunityVerdicts);
