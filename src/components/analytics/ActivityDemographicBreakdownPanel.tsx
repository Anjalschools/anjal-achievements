"use client";

import { useMemo } from "react";
import type { ParticipationActivityRow } from "@/lib/achievement-participation-analytics";
import { buildActivityDemographicBreakdowns } from "@/lib/analytics/analytics-demographic-intelligence";

export type ActivityDemographicBreakdownPanelProps = {
  isAr: boolean;
  table: ParticipationActivityRow[];
};

const ActivityDemographicBreakdownPanel = ({ isAr, table }: ActivityDemographicBreakdownPanelProps) => {
  const items = useMemo(() => buildActivityDemographicBreakdowns(table, 5), [table]);

  if (items.length === 0) return null;

  return (
    <div className="space-y-3" dir={isAr ? "rtl" : "ltr"}>
      {items.map((a) => (
        <div key={a.activityKey} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <p className="text-sm font-black text-slate-900">{isAr ? a.labelAr : a.labelEn}</p>
          <p className="mt-1 text-[10px] text-slate-500">
            {isAr ? `${a.participations} مشاركة · أبرز: ${a.topSliceAr}` : `${a.participations} participations · top: ${a.topSliceEn}`}
          </p>
          <div className="mt-2 grid gap-2 text-[10px] font-semibold text-slate-700 sm:grid-cols-3">
            <span>
              {isAr ? "عربي/دولي" : "Ar/Intl"}: {a.bySection.arabic} / {a.bySection.international}
            </span>
            <span>
              {isAr ? "بنين/بنات" : "Boys/Girls"}: {a.byGender.male} / {a.byGender.female}
            </span>
            <span>
              {isAr ? "موهبة/غير" : "Mawhiba"}: {a.byMawhiba.mawhiba} / {a.byMawhiba.nonMawhiba}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ActivityDemographicBreakdownPanel;
