"use client";

import { memo } from "react";
import type { ExecutiveAiDecision } from "@/lib/analytics/ai/ai-decision-schema";

const ExecutiveDecisionPriorityQueue = memo(
  ({ isAr, title, decisions }: { isAr: boolean; title: string; decisions: ExecutiveAiDecision[] }) => {
    if (decisions.length === 0) return null;
    return (
      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/30 p-4" dir={isAr ? "rtl" : "ltr"}>
        <h3 className="text-xs font-black text-indigo-950">{title}</h3>
        <ol className="mt-3 space-y-2">
          {decisions.map((d, i) => (
            <li
              key={d.id}
              className="flex gap-2 rounded-xl border border-white/80 bg-white/90 px-3 py-2 text-[11px] shadow-sm"
            >
              <span className="font-black text-indigo-600">{i + 1}</span>
              <div>
                <p className="font-bold text-slate-900">{isAr ? d.titleAr : d.titleEn}</p>
                <p className="text-slate-600">{isAr ? d.executiveSummaryAr : d.executiveSummaryEn}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    );
  }
);

ExecutiveDecisionPriorityQueue.displayName = "ExecutiveDecisionPriorityQueue";

export default ExecutiveDecisionPriorityQueue;
