"use client";

import type { HistoricalEducationalIntelligence } from "@/lib/analytics/historical-educational-intelligence";
import HistoricalTimelineInsights from "@/components/analytics/HistoricalTimelineInsights";
import HistoricalIntensityHeatmap, {
  type HistoricalIntensityHeatmapProps,
} from "@/components/analytics/HistoricalIntensityHeatmap";

export type HistoricalExecutiveIntelligenceProps = {
  isAr: boolean;
  intelligence: HistoricalEducationalIntelligence;
  onDrill?: HistoricalIntensityHeatmapProps["onDrill"];
};

const kpiToneClass = (tone: string): string => {
  if (tone === "positive") return "border-emerald-200 bg-emerald-50/80";
  if (tone === "negative") return "border-rose-200 bg-rose-50/80";
  if (tone === "warning") return "border-amber-200 bg-amber-50/80";
  return "border-slate-200 bg-slate-50/80";
};

const alertSeverityClass = (s: string): string => {
  if (s === "critical") return "border-rose-300 bg-rose-50 text-rose-900";
  if (s === "warning") return "border-amber-300 bg-amber-50 text-amber-900";
  return "border-sky-200 bg-sky-50 text-sky-900";
};

const HistoricalExecutiveIntelligence = ({
  isAr,
  intelligence,
  onDrill,
}: HistoricalExecutiveIntelligenceProps) => {
  const topTrends = intelligence.activityTrends.slice(0, 3);

  return (
    <div className="space-y-4" dir={isAr ? "rtl" : "ltr"}>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {intelligence.executiveKpis.map((kpi) => (
          <div
            key={kpi.id}
            className={`rounded-xl border px-3 py-2.5 ${kpiToneClass(kpi.tone)}`}
          >
            <p className="text-[10px] font-bold text-slate-600">
              {isAr ? kpi.labelAr : kpi.labelEn}
            </p>
            <p className="mt-0.5 text-sm font-black text-slate-900">{kpi.value}</p>
            {kpi.subAr || kpi.subEn ? (
              <p className="mt-1 text-[9px] text-slate-600 line-clamp-2">
                {isAr ? kpi.subAr : kpi.subEn}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      {intelligence.alerts.length > 0 ? (
        <ul className="space-y-1.5">
          {intelligence.alerts.slice(0, 4).map((a) => (
            <li
              key={a.id}
              className={`rounded-lg border px-3 py-2 text-[11px] ${alertSeverityClass(a.severity)}`}
            >
              <span className="font-black">{isAr ? a.titleAr : a.titleEn}: </span>
              {isAr ? a.bodyAr : a.bodyEn}
            </li>
          ))}
        </ul>
      ) : null}

      {intelligence.funnel && !intelligence.funnel.sufficient ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-[11px] text-amber-950">
          {isAr ? intelligence.funnel.narrativeAr : intelligence.funnel.narrativeEn}
        </p>
      ) : null}

      {intelligence.narratives.length > 0 ? (
        <ul className="grid gap-2 md:grid-cols-2">
          {intelligence.narratives.slice(0, 6).map((n) => (
            <li
              key={n.id}
              className={`rounded-lg border px-3 py-2 text-[11px] ${
                n.exploratory
                  ? "border-amber-200 bg-amber-50/60 text-amber-950"
                  : "border-indigo-100 bg-indigo-50/40 text-slate-800"
              }`}
            >
              {isAr ? n.bodyAr : n.bodyEn}
            </li>
          ))}
        </ul>
      ) : null}

      {intelligence.heatmapCells.length > 0 ? (
        <HistoricalIntensityHeatmap
          isAr={isAr}
          cells={intelligence.heatmapCells}
          onDrill={onDrill}
        />
      ) : null}

      {topTrends.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-3">
          {topTrends.map((t) => (
            <HistoricalTimelineInsights key={t.scope.key} isAr={isAr} trend={t} compact />
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default HistoricalExecutiveIntelligence;
