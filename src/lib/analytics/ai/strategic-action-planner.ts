import type { ExecutiveAiDecision, StrategicActionPlan, SuggestedAction } from "@/lib/analytics/ai/ai-decision-schema";
import type { AiDecisionTimeHorizon } from "@/lib/analytics/ai/ai-decision-schema";
import { sortDecisionsByPriority } from "@/lib/analytics/ai/ai-decision-priority";
import { groupActionsByHorizon } from "@/lib/analytics/ai/strategic-action-grouping";
import { buildStrategicActionRoadmap } from "@/lib/analytics/ai/strategic-action-roadmap";
import { prioritizeStrategicActions } from "@/lib/analytics/ai/strategic-action-priority-engine";

export const buildStrategicActionPlan = (decisions: ExecutiveAiDecision[]): StrategicActionPlan => {
  const sorted = sortDecisionsByPriority(decisions);
  const allActions = sorted.flatMap((d) =>
    d.suggestedActions.map((a) => ({ ...a, priority: a.priority + d.priorityScore * 0.1 }))
  );
  const prioritized = prioritizeStrategicActions(allActions);
  const byHorizon = groupActionsByHorizon(sorted);

  const pick = (h: AiDecisionTimeHorizon): SuggestedAction[] => byHorizon[h] ?? [];

  return {
    immediate: pick("immediate"),
    shortTerm: pick("short_term"),
    mediumTerm: pick("medium_term"),
    longTerm: pick("long_term"),
    roadmap: buildStrategicActionRoadmap(sorted, prioritized),
  };
};
