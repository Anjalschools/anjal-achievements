"use client";

import { memo, useMemo } from "react";
import type { StudentIntelRow } from "@/lib/student-intelligence-analytics";
import { buildStudentOpportunityProfileFromIntelRow } from "@/lib/analytics/ai/opportunity-intelligence";
import { sortOpportunitiesByPriority } from "@/lib/analytics/ai/opportunity-intelligence";

export type StudentOpportunityPanelProps = {
  isAr: boolean;
  row: StudentIntelRow;
  activityKeys?: string[];
};

const decisionLabel = (d: string, isAr: boolean): string => {
  const map: Record<string, { ar: string; en: string }> = {
    ELIGIBLE: { ar: "مؤهل", en: "Eligible" },
    RECOMMENDED: { ar: "موصى به", en: "Recommended" },
    HIGH_POTENTIAL: { ar: "إمكانية عالية", en: "High potential" },
    FUTURE_OPPORTUNITY: { ar: "فرصة مستقبلية", en: "Future opportunity" },
    BLOCKED: { ar: "غير مؤهل", en: "Blocked" },
    NOT_RECOMMENDED: { ar: "غير مناسب حاليًا", en: "Not recommended now" },
  };
  return isAr ? map[d]?.ar ?? d : map[d]?.en ?? d;
};

const StudentOpportunityPanel = memo(({ isAr, row, activityKeys }: StudentOpportunityPanelProps) => {
  const profile = useMemo(
    () => buildStudentOpportunityProfileFromIntelRow(row, { activityKeys }),
    [row, activityKeys]
  );

  const top = useMemo(
    () =>
      sortOpportunitiesByPriority([
        ...profile.recommendedCompetitions,
        ...profile.futureOpportunities,
        ...profile.eligibleCompetitions,
      ]).slice(0, 8),
    [profile]
  );

  const blocked = profile.blockedCompetitions.slice(0, 6);

  return (
    <div className="rounded-2xl border border-violet-200 bg-violet-50/40 p-4" dir={isAr ? "rtl" : "ltr"}>
      <h4 className="text-sm font-black text-violet-950">
        {isAr ? "ذكاء الفرص الأكاديمية" : "Academic opportunity intelligence"}
      </h4>
      <p className="mt-1 text-[10px] text-violet-800">
        {isAr ? row.nameAr : row.nameEn} · {isAr ? row.stageLabelAr : row.stageLabelEn}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-slate-800">
          {isAr ? "جاهزية" : "Readiness"}: {profile.readinessScore}/100
        </span>
        <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-slate-800">
          {isAr ? "فرصة أكاديمية" : "Opportunity"}: {profile.academicOpportunityScore}/100
        </span>
        <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-slate-800">
          {isAr ? "أولمبياد" : "Olympiad"}: {profile.olympiadPotentialScore}/100
        </span>
      </div>

      {profile.pathwayRecommendations.length > 0 && (
        <div className="mt-3 rounded-xl border border-violet-100 bg-white p-3">
          <p className="text-[10px] font-black text-violet-900">
            {isAr ? "مسار مقترح" : "Suggested pathway"}
          </p>
          <p className="mt-1 text-xs text-slate-800">
            {isAr
              ? profile.pathwayRecommendations[0]!.rationaleAr
              : profile.pathwayRecommendations[0]!.rationaleEn}
          </p>
        </div>
      )}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div>
          <p className="text-[10px] font-black text-emerald-900">{isAr ? "موصى به / مؤهل" : "Recommended"}</p>
          <ul className="mt-2 space-y-2">
            {top.map((v) => (
              <li key={v.competitionKey} className="rounded-lg border border-emerald-100 bg-white p-2 text-[10px]">
                <div className="flex justify-between gap-2 font-bold text-slate-900">
                  <span>{isAr ? v.titleAr : v.titleEn}</span>
                  <span className="text-emerald-800">{decisionLabel(v.decision, isAr)}</span>
                </div>
                <p className="mt-1 text-slate-600">{isAr ? v.reasonsAr[0] : v.reasonsEn[0]}</p>
                <p className="text-slate-500">
                  {isAr ? "ثقة" : "Confidence"}: {Math.round(v.confidence * 100)}% · {isAr ? "ملاءمة" : "Match"}:{" "}
                  {v.matchScore}
                </p>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[10px] font-black text-rose-900">{isAr ? "محظور / غير مناسب" : "Blocked"}</p>
          <ul className="mt-2 space-y-2">
            {blocked.map((v) => (
              <li key={v.competitionKey} className="rounded-lg border border-rose-100 bg-white p-2 text-[10px]">
                <div className="font-bold text-slate-900">{isAr ? v.titleAr : v.titleEn}</div>
                <p className="mt-1 text-slate-600">{isAr ? v.reasonsAr[0] : v.reasonsEn[0]}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
});

StudentOpportunityPanel.displayName = "StudentOpportunityPanel";
export default StudentOpportunityPanel;
