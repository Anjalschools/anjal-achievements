import type { ExecutiveAiDecision, SuggestedAction, AiDecisionTimeHorizon } from "@/lib/analytics/ai/ai-decision-schema";

const phaseLabels: Record<AiDecisionTimeHorizon, { ar: string; en: string }> = {
  immediate: { ar: "فوري", en: "Immediate" },
  short_term: { ar: "قصير المدى", en: "Short term" },
  medium_term: { ar: "متوسط المدى", en: "Medium term" },
  long_term: { ar: "طويل المدى", en: "Long term" },
};

export const buildStrategicActionRoadmap = (
  decisions: ExecutiveAiDecision[],
  prioritizedActions: SuggestedAction[]
): Array<{
  phase: AiDecisionTimeHorizon;
  titleAr: string;
  titleEn: string;
  actions: SuggestedAction[];
}> => {
  const horizons: AiDecisionTimeHorizon[] = ["immediate", "short_term", "medium_term", "long_term"];
  return horizons.map((phase) => {
    const phaseDecisions = decisions.filter((d) => d.timeHorizon === phase);
    const actions =
      phaseDecisions.length > 0
        ? phaseDecisions.flatMap((d) => d.suggestedActions)
        : prioritizedActions.slice(0, 3);
    return {
      phase,
      titleAr: phaseLabels[phase].ar,
      titleEn: phaseLabels[phase].en,
      actions: actions.slice(0, 6),
    };
  });
};
