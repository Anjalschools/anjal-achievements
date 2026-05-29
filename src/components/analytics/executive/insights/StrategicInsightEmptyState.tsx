"use client";

import { memo } from "react";
import { resolveExecutiveEmptyState } from "@/lib/analytics/analytics-empty-state-intelligence";

export type StrategicInsightEmptyStateProps = {
  isAr: boolean;
  filterCount?: number;
};

const StrategicInsightEmptyState = memo(({ isAr, filterCount = 0 }: StrategicInsightEmptyStateProps) => {
  const state = resolveExecutiveEmptyState({ filterCount });
  return (
    <div
      className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center"
      dir={isAr ? "rtl" : "ltr"}
    >
      <p className="text-sm font-black text-slate-800">{isAr ? state.titleAr : state.titleEn}</p>
      <p className="mt-2 text-xs text-slate-600">{isAr ? state.reasonAr : state.reasonEn}</p>
      <ul className="mt-3 space-y-1 text-[11px] text-indigo-800">
        {(isAr ? state.suggestionsAr : state.suggestionsEn).map((s) => (
          <li key={s}>→ {s}</li>
        ))}
      </ul>
      <p className="mt-3 text-[10px] font-semibold text-amber-800">
        {isAr ? "مستوى الثقة: استكشافي — وسّع النطاق لرؤى أقوى" : "Confidence: exploratory — broaden scope for stronger insights"}
      </p>
    </div>
  );
});

StrategicInsightEmptyState.displayName = "StrategicInsightEmptyState";

export default StrategicInsightEmptyState;
