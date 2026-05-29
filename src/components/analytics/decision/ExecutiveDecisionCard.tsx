"use client";

import { memo } from "react";
import type { ExecutiveAiDecision } from "@/lib/analytics/ai/ai-decision-schema";
import { severityBadgeClass } from "@/lib/analytics/ai/ai-decision-severity";
import { confidenceLabel } from "@/lib/analytics/ai/ai-decision-confidence";
import ExecutiveDecisionEvidence from "@/components/analytics/decision/ExecutiveDecisionEvidence";
import ExecutiveDecisionActions from "@/components/analytics/decision/ExecutiveDecisionActions";
import ExecutiveDecisionImpact from "@/components/analytics/decision/ExecutiveDecisionImpact";

export type ExecutiveDecisionCardProps = {
  isAr: boolean;
  decision: ExecutiveAiDecision;
};

const ExecutiveDecisionCard = memo(({ isAr, decision }: ExecutiveDecisionCardProps) => {
  const lowConf = decision.confidence === "LOW" || decision.confidence === "EXPLORATORY";
  return (
    <article
      className={`rounded-2xl border p-4 shadow-sm transition hover:shadow-md ${severityBadgeClass(decision.severity)} ${
        lowConf ? "opacity-90 saturate-75" : ""
      } ${decision.confidence === "EXPLORATORY" ? "border-dashed" : ""}`}
      dir={isAr ? "rtl" : "ltr"}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="text-xs font-black text-slate-900">{isAr ? decision.titleAr : decision.titleEn}</h4>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-700">
            {isAr ? decision.executiveSummaryAr : decision.executiveSummaryEn}
          </p>
        </div>
        <span className="rounded-full px-2 py-0.5 text-[9px] font-bold ring-1">
          {decision.severity}
        </span>
      </header>
      <p className="mt-2 text-[10px] font-semibold text-slate-600">{confidenceLabel(decision.confidence, isAr)}</p>
      <ExecutiveDecisionImpact isAr={isAr} decision={decision} />
      <ExecutiveDecisionEvidence isAr={isAr} evidence={decision.evidence} explainability={decision.explainability} />
      <ExecutiveDecisionActions isAr={isAr} actions={decision.suggestedActions} />
    </article>
  );
});

ExecutiveDecisionCard.displayName = "ExecutiveDecisionCard";

export default ExecutiveDecisionCard;
