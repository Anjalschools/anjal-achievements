"use client";

import { memo } from "react";
import type { SuggestedAction } from "@/lib/analytics/ai/ai-decision-schema";

const ExecutiveDecisionActions = memo(
  ({ isAr, actions }: { isAr: boolean; actions: SuggestedAction[] }) => {
    if (actions.length === 0) return null;
    return (
      <div className="mt-2 rounded-lg border border-teal-100 bg-teal-50/40 p-2">
        <p className="text-[9px] font-black text-teal-800">{isAr ? "إجراءات مقترحة" : "Suggested actions"}</p>
        <ul className="mt-1 space-y-1">
          {actions.map((a) => (
            <li key={a.id} className="text-[10px] text-teal-950">
              → {isAr ? a.labelAr : a.labelEn}
            </li>
          ))}
        </ul>
      </div>
    );
  }
);

ExecutiveDecisionActions.displayName = "ExecutiveDecisionActions";

export default ExecutiveDecisionActions;
