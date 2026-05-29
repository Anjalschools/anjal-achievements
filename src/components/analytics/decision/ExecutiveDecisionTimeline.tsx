"use client";

import { memo } from "react";
import type { ExecutiveAiDecision } from "@/lib/analytics/ai/ai-decision-schema";

const ExecutiveDecisionTimeline = memo(
  ({ isAr, decisions }: { isAr: boolean; decisions: ExecutiveAiDecision[] }) => (
    <ol className="flex flex-wrap items-center gap-2" dir={isAr ? "rtl" : "ltr"}>
      {decisions.slice(0, 8).map((d, i) => (
        <li key={d.id} className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-1 text-[10px] font-bold ${
              d.timeHorizon === "immediate" ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            {d.timeHorizon}
          </span>
          {i < Math.min(decisions.length, 8) - 1 ? <span className="text-slate-300">→</span> : null}
        </li>
      ))}
    </ol>
  )
);

ExecutiveDecisionTimeline.displayName = "ExecutiveDecisionTimeline";

export default ExecutiveDecisionTimeline;
