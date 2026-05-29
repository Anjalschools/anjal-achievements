"use client";

import { memo } from "react";
import type { InsightConfidence } from "@/lib/analytics/intelligence/analytics-narrative-schema";

export type ExecutiveAccordionSummaryProps = {
  isAr: boolean;
  kpi?: string;
  insight?: string;
  warning?: string;
  confidence?: InsightConfidence;
};

const confidenceLabel = (c: InsightConfidence, isAr: boolean): string => {
  if (c === "HIGH") return isAr ? "ثقة عالية" : "High";
  if (c === "MEDIUM") return isAr ? "ثقة متوسطة" : "Medium";
  if (c === "LOW") return isAr ? "ثقة منخفضة" : "Low";
  return isAr ? "استكشافي" : "Exploratory";
};

const ExecutiveAccordionSummary = memo(
  ({ isAr, kpi, insight, warning, confidence }: ExecutiveAccordionSummaryProps) => {
    if (!kpi && !insight && !warning && !confidence) return null;
    return (
      <div className="mt-2 flex flex-wrap gap-1.5 border-t border-slate-100 pt-2 print:hidden">
        {kpi ? (
          <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[9px] font-bold text-indigo-900">
            KPI: {kpi}
          </span>
        ) : null}
        {insight ? (
          <span className="max-w-[14rem] truncate rounded-md bg-teal-50 px-2 py-0.5 text-[9px] font-semibold text-teal-900">
            {insight}
          </span>
        ) : null}
        {warning ? (
          <span className="max-w-[14rem] truncate rounded-md bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-900">
            ⚠ {warning}
          </span>
        ) : null}
        {confidence ? (
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-700">
            {confidenceLabel(confidence, isAr)}
          </span>
        ) : null}
      </div>
    );
  }
);

ExecutiveAccordionSummary.displayName = "ExecutiveAccordionSummary";

export default ExecutiveAccordionSummary;
