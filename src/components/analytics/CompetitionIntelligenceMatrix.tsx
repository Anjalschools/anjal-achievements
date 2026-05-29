"use client";

import { useMemo } from "react";
import type { ParticipationActivityRow } from "@/lib/achievement-participation-analytics";
import { buildCompetitionMatrix } from "@/lib/analytics/analytics-demographic-intelligence";
import { useAnalyticsPerspective } from "@/lib/analytics/analytics-perspective-context";
import {
  formatParticipationCount,
  formatStudentCount,
  t,
  type AnalyticsLocale,
} from "@/lib/analytics/analytics-semantic-registry";
import type { DrillChartSource } from "@/lib/analytics/analytics-drilldown-router";

export type CompetitionIntelligenceMatrixProps = {
  isAr: boolean;
  table: ParticipationActivityRow[];
  onDrill?: (
    source: DrillChartSource,
    payload: { activityKey?: string; labelAr?: string; labelEn?: string; key?: string }
  ) => void;
};

const CompetitionIntelligenceMatrix = ({
  isAr,
  table,
  onDrill,
}: CompetitionIntelligenceMatrixProps) => {
  const { perspective, loc: ctxLoc } = useAnalyticsPerspective();
  const loc: AnalyticsLocale = isAr ? "ar" : "en";
  const rows = useMemo(() => buildCompetitionMatrix(table, 15, perspective), [table, perspective]);

  if (rows.length === 0) {
    return (
      <p className="text-center text-xs text-slate-500">
        {isAr ? "لا توجد أنشطة ضمن الفلاتر." : "No activities under current filters."}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto" dir={isAr ? "rtl" : "ltr"}>
      <table className="w-full min-w-[960px] text-left text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
            <th className="px-2 py-2 font-bold">{isAr ? "النشاط" : "Activity"}</th>
            <th className="px-2 py-2 font-bold">{isAr ? "النوع" : "Type"}</th>
            <th className="px-2 py-2 font-bold">
              {perspective === "student"
                ? t("column.studentCount", ctxLoc)
                : perspective === "achievement"
                  ? t("column.achievementCount", ctxLoc)
                  : perspective === "result"
                    ? t("column.resultCount", ctxLoc)
                    : perspective === "record"
                      ? t("column.recordCount", ctxLoc)
                      : t("column.totalParticipations", ctxLoc)}
            </th>
            <th className="px-2 py-2 font-bold">{t("column.studentCount", loc)}</th>
            <th className="px-2 py-2 font-bold">{isAr ? "كثافة" : "Density"}</th>
            <th className="px-2 py-2 font-bold">{t("kpi.medalConversion", loc)}</th>
            <th className="px-2 py-2 font-bold">{isAr ? "ميداليات" : "Medals"}</th>
            <th className="px-2 py-2 font-bold">{isAr ? "أعلى قسم" : "Top section"}</th>
            <th className="px-2 py-2 font-bold">{isAr ? "أبرز فئة" : "Top cohort"}</th>
            <th className="px-2 py-2 font-bold">{isAr ? "المستوى" : "Level"}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.activityKey}
              className="cursor-pointer border-b border-slate-100 hover:bg-indigo-50/40"
              onClick={() =>
                onDrill?.("activity_row", {
                  activityKey: r.activityKey,
                  labelAr: r.labelAr,
                  labelEn: r.labelEn,
                  key: r.activityKey,
                })
              }
              tabIndex={0}
              role="button"
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onDrill?.("activity_row", {
                    activityKey: r.activityKey,
                    labelAr: r.labelAr,
                    labelEn: r.labelEn,
                  });
                }
              }}
            >
              <td className="px-2 py-2 font-semibold">{isAr ? r.labelAr : r.labelEn}</td>
              <td className="px-2 py-2">{isAr ? r.typeLabelAr : r.typeLabelEn}</td>
              <td className="px-2 py-2 tabular-nums">{formatParticipationCount(r.participations, loc)}</td>
              <td className="px-2 py-2 tabular-nums">{formatStudentCount(r.students, loc)}</td>
              <td className="px-2 py-2 tabular-nums">{r.density}</td>
              <td className="px-2 py-2 tabular-nums">{r.conversionPct}%</td>
              <td className="px-2 py-2 tabular-nums">{r.medals}</td>
              <td className="px-2 py-2">{isAr ? r.topSectionAr : r.topSectionEn}</td>
              <td className="px-2 py-2">{isAr ? r.topDemographicAr : r.topDemographicEn}</td>
              <td className="px-2 py-2">{isAr ? r.topLevelAr : r.topLevelEn}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CompetitionIntelligenceMatrix;
