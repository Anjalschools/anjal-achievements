"use client";

import { memo } from "react";

export type StudentExcellenceInsightPanelProps = {
  isAr: boolean;
  insightAr: string;
  insightEn: string;
  confidenceLabel?: string;
};

const StudentExcellenceInsightPanel = memo(
  ({ isAr, insightAr, insightEn, confidenceLabel }: StudentExcellenceInsightPanelProps) => (
    <div
      className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3"
      dir={isAr ? "rtl" : "ltr"}
    >
      <p className="text-[9px] font-black uppercase tracking-wide text-indigo-800">
        {isAr ? "رؤية تنفيذية" : "Executive insight"}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-indigo-950">{isAr ? insightAr : insightEn}</p>
      {confidenceLabel ? (
        <p className="mt-2 text-[10px] font-semibold text-slate-600">{confidenceLabel}</p>
      ) : null}
    </div>
  )
);

StudentExcellenceInsightPanel.displayName = "StudentExcellenceInsightPanel";

export default StudentExcellenceInsightPanel;
