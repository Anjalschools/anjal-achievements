import type { ExecutiveAiDecision } from "@/lib/analytics/ai/ai-decision-schema";

export const summarizeExpectedOutcome = (d: ExecutiveAiDecision, isAr: boolean): string => {
  const sim = d.impactSimulation;
  if (!sim) return isAr ? d.expectedOutcomeAr : d.expectedOutcomeEn;
  if (isAr) {
    return `مشاركة +${sim.expectedParticipationChangePct}% · جوائز +${sim.expectedAwardGrowthPct}% · منفعة مؤسسية ${sim.institutionalBenefitScore}/100`;
  }
  return `Participation +${sim.expectedParticipationChangePct}% · Awards +${sim.expectedAwardGrowthPct}% · Benefit ${sim.institutionalBenefitScore}/100`;
};
