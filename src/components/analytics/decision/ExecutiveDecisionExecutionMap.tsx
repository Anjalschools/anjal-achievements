"use client";

import { memo } from "react";
import type { StrategicActionPlan } from "@/lib/analytics/ai/ai-decision-schema";

const ExecutiveDecisionExecutionMap = memo(
  ({ isAr, plan }: { isAr: boolean; plan: StrategicActionPlan }) => (
    <div className="grid gap-3 md:grid-cols-2" dir={isAr ? "rtl" : "ltr"}>
      {plan.roadmap.map((phase) => (
        <div key={phase.phase} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs font-black text-slate-800">{isAr ? phase.titleAr : phase.titleEn}</p>
          <ul className="mt-2 space-y-1 text-[10px] text-slate-700">
            {phase.actions.length === 0 ? (
              <li>{isAr ? "—" : "—"}</li>
            ) : (
              phase.actions.map((a) => (
                <li key={a.id}>→ {isAr ? a.labelAr : a.labelEn}</li>
              ))
            )}
          </ul>
        </div>
      ))}
    </div>
  )
);

ExecutiveDecisionExecutionMap.displayName = "ExecutiveDecisionExecutionMap";

export default ExecutiveDecisionExecutionMap;
