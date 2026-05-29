"use client";

import { memo } from "react";
import type { ExecutiveAiDecision } from "@/lib/analytics/ai/ai-decision-schema";

const ExecutiveDecisionImpact = memo(
  ({ isAr, decision }: { isAr: boolean; decision: ExecutiveAiDecision }) => {
    const sim = decision.impactSimulation;
    if (!sim) return null;
    return (
      <div className="mt-2 flex flex-wrap gap-1 text-[9px] font-bold text-indigo-800">
        <span className="rounded-md bg-indigo-50 px-1.5 py-0.5">
          {isAr ? "مشاركة" : "Part."} +{sim.expectedParticipationChangePct}%
        </span>
        <span className="rounded-md bg-indigo-50 px-1.5 py-0.5">
          {isAr ? "جوائز" : "Awards"} +{sim.expectedAwardGrowthPct}%
        </span>
        <span className="rounded-md bg-violet-50 px-1.5 py-0.5">
          {isAr ? "منفعة" : "Benefit"} {sim.institutionalBenefitScore}
        </span>
      </div>
    );
  }
);

ExecutiveDecisionImpact.displayName = "ExecutiveDecisionImpact";

export default ExecutiveDecisionImpact;
