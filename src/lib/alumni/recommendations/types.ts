/**
 * Rule-based recommendation payloads (v1) — explainable, bounded scores (no ML ranking).
 */

export type RecommendationKind =
  | "similar_alumni"
  | "mentor"
  | "opportunity"
  | "event"
  | "potential_group";

export type ExplainableSignals = {
  reasons: string[];
  matchedSignals: Record<string, boolean>;
  matchWeights: Record<string, number>;
  confidence: number;
  relevanceScore: number;
};

export type ExplainableRecommendation<T extends Record<string, unknown>> = T & ExplainableSignals;
