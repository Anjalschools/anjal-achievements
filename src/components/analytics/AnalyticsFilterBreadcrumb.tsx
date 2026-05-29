"use client";

import { X } from "lucide-react";
import type { ExecutiveFilterSnapshot } from "@/lib/competition-intelligence-persistence";
import { buildAnalyticsFilterChips } from "@/lib/analytics/analytics-filter-chips";
import { defaultExecutiveFilterSnapshot } from "@/lib/competition-intelligence-persistence";
import { useClientMounted } from "@/hooks/useClientMounted";

export type AnalyticsFilterBreadcrumbProps = {
  isAr: boolean;
  f: ExecutiveFilterSnapshot;
  onClear: () => void;
};

const AnalyticsFilterBreadcrumb = ({ isAr, f, onClear }: AnalyticsFilterBreadcrumbProps) => {
  const mounted = useClientMounted();
  const chips = mounted ? buildAnalyticsFilterChips(f, isAr) : [];
  const hasFilters = chips.length > 0;

  return (
    <div
      className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 print:hidden"
      dir={isAr ? "rtl" : "ltr"}
      role="region"
      aria-label={isAr ? "الفلاتر الحالية" : "Current filters"}
    >
      <span className="text-xs font-black text-slate-700">
        {isAr ? "الفلاتر الحالية:" : "Current filters:"}
      </span>
      <span
        className={`text-xs text-slate-500 ${hasFilters ? "hidden" : ""}`}
        aria-hidden={hasFilters}
      >
        {isAr ? "بدون فلاتر إضافية" : "No extra filters"}
      </span>
      {chips.map((c) => (
        <span
          key={c.key}
          className="rounded-full border border-indigo-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-indigo-900"
        >
          {c.label}
        </span>
      ))}
      <button
        type="button"
        onClick={() => onClear()}
        className="ms-auto inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
        aria-label={isAr ? "مسح الفلاتر" : "Clear filters"}
      >
        <X className="h-3.5 w-3.5" aria-hidden />
        {isAr ? "مسح" : "Clear"}
      </button>
    </div>
  );
};

export const clearParticipationFilters = (f: ExecutiveFilterSnapshot): ExecutiveFilterSnapshot => {
  const base = defaultExecutiveFilterSnapshot();
  return {
    ...f,
    activityYears: [],
    achievementNames: [],
    categories: [],
    sections: [],
    genders: [],
    mawhibaValues: [],
    stages: [],
    grades: [],
    levels: [],
    resultTokens: [],
    statuses: [],
    certificateStatuses: [],
    standardizedTestTypes: [],
    fromDate: "",
    toDate: "",
    domain: "",
    classification: "",
    organization: "",
    primaryType: "all",
  };
};

export default AnalyticsFilterBreadcrumb;
