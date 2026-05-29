import type { ExecutiveAiDecision, SuggestedAction, AiDecisionTimeHorizon } from "@/lib/analytics/ai/ai-decision-schema";

export const groupActionsByHorizon = (
  decisions: ExecutiveAiDecision[]
): Record<AiDecisionTimeHorizon, SuggestedAction[]> => {
  const buckets: Record<AiDecisionTimeHorizon, SuggestedAction[]> = {
    immediate: [],
    short_term: [],
    medium_term: [],
    long_term: [],
  };

  for (const d of decisions) {
    for (const a of d.suggestedActions) {
      buckets[d.timeHorizon].push(a);
    }
  }

  return buckets;
};

export const groupDecisionsBySeverity = (
  decisions: ExecutiveAiDecision[]
): Map<string, ExecutiveAiDecision[]> => {
  const map = new Map<string, ExecutiveAiDecision[]>();
  for (const d of decisions) {
    const list = map.get(d.severity) ?? [];
    list.push(d);
    map.set(d.severity, list);
  }
  return map;
};
