import type { ExecutiveAiDecision } from "@/lib/analytics/ai/ai-decision-schema";

/** Aggregate institutional benefit across top decisions (bounded). */
export const aggregateInstitutionalBenefit = (decisions: ExecutiveAiDecision[]): number => {
  if (decisions.length === 0) return 0;
  const top = decisions.slice(0, 8);
  const sum = top.reduce((s, d) => s + (d.impactSimulation?.institutionalBenefitScore ?? 0), 0);
  return Math.min(100, Math.round(sum / top.length));
};
