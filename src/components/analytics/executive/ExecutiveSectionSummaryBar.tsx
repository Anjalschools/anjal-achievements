"use client";

import { memo } from "react";

export type ExecutiveSectionSummaryBarProps = {
  isAr: boolean;
  analyticsCount?: number;
  metricLabel?: string;
  exploratory?: boolean;
  budgetHint?: string;
};

const ExecutiveSectionSummaryBar = memo(
  ({ isAr, analyticsCount, metricLabel, exploratory, budgetHint }: ExecutiveSectionSummaryBarProps) => (
    <div className="mt-1 flex flex-wrap items-center gap-1.5 print:hidden">
      {typeof analyticsCount === "number" ? (
        <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[9px] font-bold text-indigo-900">
          {isAr ? `${analyticsCount} مؤشر` : `${analyticsCount} metrics`}
        </span>
      ) : null}
      {metricLabel ? (
        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-700">
          {metricLabel}
        </span>
      ) : null}
      {exploratory ? (
        <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-900">
          {isAr ? "استكشافي" : "Exploratory"}
        </span>
      ) : null}
      {budgetHint ? (
        <span className="rounded-md bg-violet-50 px-2 py-0.5 text-[9px] font-semibold text-violet-900">
          {budgetHint}
        </span>
      ) : null}
    </div>
  )
);

ExecutiveSectionSummaryBar.displayName = "ExecutiveSectionSummaryBar";

export default ExecutiveSectionSummaryBar;
