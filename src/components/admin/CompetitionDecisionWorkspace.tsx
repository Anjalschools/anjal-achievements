"use client";

import { memo, useMemo } from "react";
import type { FocusedActivityReportPayload } from "@/types/focused-activity-report";
import { CompetitionDecisionSections } from "@/components/admin/CompetitionDecisionSections";

export type CompetitionDecisionWorkspaceProps = {
  isAr: boolean;
  report: FocusedActivityReportPayload;
};

export const CompetitionDecisionWorkspace = memo(({ isAr, report }: CompetitionDecisionWorkspaceProps) => {
  const dp = report.decisionPlatform;
  const activityLabel = useMemo(
    () => (isAr ? report.activityLabelAr : report.activityLabelEn),
    [isAr, report.activityLabelAr, report.activityLabelEn]
  );

  return (
    <section className="space-y-4" dir={isAr ? "rtl" : "ltr"}>
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-indigo-50/60 to-white p-4 shadow-sm">
        <h2 className="text-sm font-black text-slate-900">
          {isAr ? "قرارات المسابقة" : "Competition decisions"}
        </h2>
        <p className="mt-1 text-xs text-slate-600" dir="auto">
          {isAr
            ? "ملخص تنفيذي قواعدي لمعدلات القبول/الاعتماد والاتجاهات وأفضل الأنشطة ضمن النشاط المحدد."
            : "Rule-based executive view of approval, acceptance, trends, and top segments for the selected activity."}
        </p>
      </div>

      <CompetitionDecisionSections isAr={isAr} dp={dp} activityLabel={activityLabel} />
    </section>
  );
});

CompetitionDecisionWorkspace.displayName = "CompetitionDecisionWorkspace";

