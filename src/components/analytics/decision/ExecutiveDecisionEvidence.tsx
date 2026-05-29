"use client";

import { memo } from "react";
import type { AiDecisionExplainability } from "@/lib/analytics/ai/ai-decision-schema";

const ExecutiveDecisionEvidence = memo(
  ({
    isAr,
    evidence,
    explainability,
  }: {
    isAr: boolean;
    evidence: string[];
    explainability?: AiDecisionExplainability;
  }) => {
    if (evidence.length === 0 && !explainability) return null;
    return (
      <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50/80 p-2 text-[10px] text-slate-700">
        <p className="font-black text-slate-500">{isAr ? "الأدلة" : "Evidence"}</p>
        <ul className="mt-1 space-y-0.5">
          {evidence.slice(0, 4).map((e) => (
            <li key={e}>· {e}</li>
          ))}
        </ul>
        {explainability ? (
          <p className="mt-2 text-slate-600">{isAr ? explainability.whyCreatedAr : explainability.whyCreatedEn}</p>
        ) : null}
      </div>
    );
  }
);

ExecutiveDecisionEvidence.displayName = "ExecutiveDecisionEvidence";

export default ExecutiveDecisionEvidence;
