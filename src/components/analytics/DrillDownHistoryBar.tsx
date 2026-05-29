"use client";

import { ChevronLeft, ChevronRight, History } from "lucide-react";
import { useAnalyticsFilters } from "@/contexts/AnalyticsFilterContext";

const DrillDownHistoryBar = ({ isAr }: { isAr: boolean }) => {
  const { canDrillBack, drillBack, explorationHistory, lastDrillTrace, clearExplorationHistory } =
    useAnalyticsFilters();

  if (explorationHistory.length === 0 && !lastDrillTrace) return null;

  return (
    <div
      className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50/40 px-3 py-2 print:hidden"
      dir={isAr ? "rtl" : "ltr"}
      role="navigation"
      aria-label={isAr ? "سجل الاستكشاف" : "Exploration history"}
    >
      <History className="h-4 w-4 shrink-0 text-indigo-600" aria-hidden />
      <button
        type="button"
        disabled={!canDrillBack}
        onClick={drillBack}
        className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-xs font-bold text-indigo-800 disabled:opacity-40"
        aria-label={isAr ? "الخطوة السابقة" : "Previous step"}
      >
        {isAr ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        {isAr ? "رجوع" : "Back"}
      </button>
      {lastDrillTrace ? (
        <span className="text-[11px] text-indigo-900/90">
          {isAr
            ? `${lastDrillTrace.labelAr ?? lastDrillTrace.sourceChart} · ${lastDrillTrace.traceId.slice(0, 10)}`
            : `${lastDrillTrace.labelEn ?? lastDrillTrace.sourceChart} · ${lastDrillTrace.traceId.slice(0, 10)}`}
        </span>
      ) : null}
      {explorationHistory.length > 1 ? (
        <span className="text-[10px] text-indigo-700/80">
          {isAr ? `${explorationHistory.length} خطوات` : `${explorationHistory.length} steps`}
        </span>
      ) : null}
      <button
        type="button"
        onClick={clearExplorationHistory}
        className="ms-auto rounded-lg px-2 py-1 text-[10px] font-semibold text-indigo-700 hover:bg-white/80"
      >
        {isAr ? "مسح السجل" : "Clear history"}
      </button>
    </div>
  );
};

export default DrillDownHistoryBar;
