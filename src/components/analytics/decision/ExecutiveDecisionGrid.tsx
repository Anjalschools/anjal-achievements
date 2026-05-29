"use client";

import { memo } from "react";
import type { ExecutiveAiDecision } from "@/lib/analytics/ai/ai-decision-schema";
import ExecutiveDecisionCard from "@/components/analytics/decision/ExecutiveDecisionCard";

export type ExecutiveDecisionGridProps = {
  isAr: boolean;
  decisions: ExecutiveAiDecision[];
};

const ExecutiveDecisionGrid = memo(({ isAr, decisions }: ExecutiveDecisionGridProps) => {
  if (decisions.length === 0) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" role="list">
      {decisions.map((d) => (
        <div key={d.id} role="listitem">
          <ExecutiveDecisionCard isAr={isAr} decision={d} />
        </div>
      ))}
    </div>
  );
});

ExecutiveDecisionGrid.displayName = "ExecutiveDecisionGrid";

export default ExecutiveDecisionGrid;
