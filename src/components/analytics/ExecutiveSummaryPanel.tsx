"use client";

import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";
import type { AnalyticsInsightsBundle } from "@/lib/analytics/analytics-insights-engine";
import { useAnalyticsFilters } from "@/contexts/AnalyticsFilterContext";
import { topYearFromTrend } from "@/lib/analytics/participation-dashboard-derivations";
import { buildParticipationCountingSnapshot } from "@/lib/analytics/analytics-counting-contract";
import {
  formatParticipationCount,
  formatStudentCount,
  formatMedalCount,
  uniqueStudentsLabel,
} from "@/lib/analytics/analytics-semantics";
import ResponsiveAnalyticsGrid from "@/components/analytics/layouts/ResponsiveAnalyticsGrid";
import { CI_TYPOGRAPHY } from "@/lib/competition-intelligence-theme";

export type ExecutiveSummaryPanelProps = {
  isAr: boolean;
  data: ParticipationAnalyticsPayload;
  insights: AnalyticsInsightsBundle;
};

const ExecutiveSummaryPanel = ({ isAr, data, insights }: ExecutiveSummaryPanelProps) => {
  const { applyDrillFromChart } = useAnalyticsFilters();
  const kpi = data.kpis;
  const counts = buildParticipationCountingSnapshot(data);
  const topYear = topYearFromTrend(data);
  const loc = isAr ? "ar" : "en";
  const topInsights = insights.insights.slice(0, 4);

  const kpiItems = [
    {
      label: isAr ? "المشاركات" : "Participations",
      value: formatParticipationCount(counts.participationCount, loc),
      onDrill: () => applyDrillFromChart("kpi", { metricKey: "totalParticipations" }),
    },
    {
      label: uniqueStudentsLabel(loc),
      value: formatStudentCount(counts.uniqueStudentsCount, loc),
      onDrill: () => applyDrillFromChart("kpi", { metricKey: "distinctStudents" }),
    },
    {
      label: isAr ? "ذهبية" : "Gold",
      value: formatMedalCount(counts.goldCount, loc),
      onDrill: () => applyDrillFromChart("kpi", { metricKey: "goldMedalCount" }),
    },
    {
      label: isAr ? "معدل ميداليات" : "Medal rate",
      value: `${counts.medalConversionRatePct}%`,
      onDrill: () => applyDrillFromChart("outcome_donut", { key: "gold" }),
    },
    {
      label: isAr ? "دولي %" : "Intl. %",
      value: `${kpi.internationalAchievementPct}%`,
      onDrill: () => applyDrillFromChart("kpi", { metricKey: "international" }),
    },
    {
      label: isAr ? "أعلى سنة" : "Peak year",
      value: topYear ? topYear.year : "—",
      onDrill: topYear
        ? () => applyDrillFromChart("year_trend", { year: topYear.year })
        : undefined,
    },
  ];

  return (
    <section
      className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm print:break-inside-avoid executive-print-summary"
      aria-label={isAr ? "الملخص التنفيذي" : "Executive summary"}
    >
      <h2 className="text-base font-black text-slate-900">
        {isAr ? "وضع القيادة — ملخص تنفيذي" : "Executive mode — leadership summary"}
      </h2>
      <ResponsiveAnalyticsGrid kpiCols="compact" className="mt-4">
        {kpiItems.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={item.onDrill}
            disabled={!item.onDrill}
            className="rounded-xl border border-slate-200 bg-white p-3 text-start shadow-sm transition hover:ring-2 hover:ring-indigo-100 disabled:cursor-default"
          >
            <p className={CI_TYPOGRAPHY.kpiLabel}>{item.label}</p>
            <p className={`mt-1 ${CI_TYPOGRAPHY.kpiValue}`}>{item.value}</p>
          </button>
        ))}
      </ResponsiveAnalyticsGrid>
      {topInsights.length > 0 ? (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 print:grid-cols-2">
          {topInsights.map((ins) => (
            <li key={ins.id}>
              <button
                type="button"
                onClick={() =>
                  applyDrillFromChart("insight", { insightId: ins.id, key: ins.id })
                }
                className="w-full rounded-lg border border-indigo-100 bg-indigo-50/40 px-3 py-2 text-start text-xs hover:bg-indigo-50"
              >
                <p className="font-bold text-slate-900">{isAr ? ins.titleAr : ins.titleEn}</p>
                <p className="mt-1 line-clamp-2 text-slate-600">{isAr ? ins.bodyAr : ins.bodyEn}</p>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
};

export default ExecutiveSummaryPanel;
