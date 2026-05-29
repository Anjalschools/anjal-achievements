"use client";

import { useMemo } from "react";
import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";
import { buildEquityIntelligence } from "@/lib/analytics/analytics-equity-intelligence";
import { useAnalyticsPerspective } from "@/lib/analytics/analytics-perspective-context";
import { useIntelligenceWorkspace } from "@/lib/analytics/intelligence-workspace-context";
import { buildEquityScoreExplanation } from "@/lib/analytics/analytics-explainable-scores";
import { t, normalizeDimensionLabel } from "@/lib/analytics/analytics-semantic-registry";
import { formatPercentage, formatScore } from "@/lib/analytics/analytics-number-formatting";
import ExplainableScoreBreakdownPanel from "@/components/analytics/ExplainableScoreBreakdownPanel";
import IntensityHeatmapGrid from "@/components/analytics/IntensityHeatmapGrid";
import DrillableMiniHBar from "@/components/analytics/DrillableMiniHBar";
import type { DrillChartSource } from "@/lib/analytics/analytics-drilldown-router";

export type EducationalEquityPanelProps = {
  isAr: boolean;
  data: ParticipationAnalyticsPayload;
  onDrill?: (source: DrillChartSource, payload: { key?: string }) => void;
  drillHint?: string;
};

const statusColor = (s: "balanced" | "warning" | "critical"): string => {
  if (s === "balanced") return "border-emerald-200 bg-emerald-50/50";
  if (s === "warning") return "border-amber-200 bg-amber-50/40";
  return "border-rose-200 bg-rose-50/40";
};

const EducationalEquityPanel = ({ isAr, data, onDrill, drillHint }: EducationalEquityPanelProps) => {
  const { perspective, loc } = useAnalyticsPerspective();
  const { expandHeatmaps } = useIntelligenceWorkspace();
  const bundle = useMemo(
    () => buildEquityIntelligence(data, perspective),
    [data, perspective]
  );
  const scoreExplain = useMemo(
    () => buildEquityScoreExplanation(data, perspective),
    [data, perspective]
  );

  const equityHeat = useMemo(
    () =>
      bundle.indicators.map((ind) => ({
        key: ind.id,
        labelAr: ind.labelAr,
        labelEn: ind.labelEn,
        intensity: ind.unit === "pct" ? Math.abs(ind.value - 50) * 2 : ind.value,
        sharePct: ind.value,
        gapFromFair: ind.unit === "pct" ? Math.abs(ind.value - 50) : ind.value,
        severity:
          ind.status === "critical"
            ? ("critical" as const)
            : ind.status === "warning"
              ? ("warning" as const)
              : ("info" as const),
      })),
    [bundle.indicators]
  );

  const repBars = [
    {
      key: "female",
      label: normalizeDimensionLabel("female", loc),
      value: bundle.indicators.find((i) => i.id === "girls_representation")?.value ?? 0,
      source: "gender_bar" as DrillChartSource,
    },
    {
      key: "male",
      label: normalizeDimensionLabel("male", loc),
      value: bundle.indicators.find((i) => i.id === "boys_representation")?.value ?? 0,
      source: "gender_bar" as DrillChartSource,
    },
    {
      key: "yes",
      label: normalizeDimensionLabel("yes", loc),
      value: bundle.indicators.find((i) => i.id === "mawhiba_representation")?.value ?? 0,
      source: "mawhiba_bar" as DrillChartSource,
    },
  ];

  return (
    <div className="space-y-4" dir={isAr ? "rtl" : "ltr"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-black text-slate-900">{t("equity.panel.title", loc)}</h3>
        <div className="flex flex-wrap gap-2">
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5">
            <p className="text-[10px] font-bold text-indigo-800">{t("equity.score", loc)}</p>
            <p className="text-lg font-black tabular-nums text-indigo-900">
              {formatScore(bundle.equityScore, loc)}
            </p>
          </div>
          <ExplainableScoreBreakdownPanel
            isAr={isAr}
            loc={loc}
            titleKey="score.explain.equity"
            bundle={scoreExplain}
            accent="indigo"
          />
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {bundle.indicators.map((ind) => (
          <div
            key={ind.id}
            className={`rounded-xl border px-3 py-2 ${statusColor(ind.status)}`}
          >
            <p className="text-[10px] font-bold text-slate-800">
              {isAr ? ind.labelAr : ind.labelEn}
            </p>
            <p className="mt-1 text-lg font-black tabular-nums text-slate-900">
              {ind.unit === "pct"
                ? formatPercentage(ind.value, loc)
                : ind.unit === "gap"
                  ? `${formatPercentage(ind.value, loc)}${isAr ? " فجوة" : " gap"}`
                  : formatPercentage(ind.value, loc)}
            </p>
          </div>
        ))}
      </div>

      {expandHeatmaps ? (
        <IntensityHeatmapGrid
          isAr={isAr}
          loc={loc}
          cells={equityHeat}
          titleKey="heatmap.equity"
          maxCells={6}
          compact
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <h4 className="text-xs font-black text-slate-800">
            {isAr ? "توزيع التمثيل" : "Representation distribution"}
          </h4>
          <div className="mt-2 space-y-2">
            {repBars.map((b) => (
              <DrillableMiniHBar
                key={b.key}
                label={`${b.label} (${b.value}%)`}
                value={b.value}
                max={100}
                isAr={isAr}
                compact
                drillLabel={drillHint}
                onDrill={onDrill ? () => onDrill(b.source, { key: b.key }) : undefined}
              />
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <h4 className="text-xs font-black text-slate-800">
            {isAr ? "رؤى العدالة" : "Equity narratives"}
          </h4>
          <ul className="mt-2 space-y-2">
            {bundle.narratives.length === 0 ? (
              <li className="text-[11px] text-slate-500">
                {isAr ? "لا رؤى حالياً" : "No equity narratives"}
              </li>
            ) : (
              bundle.narratives.map((n) => (
                <li
                  key={n.id}
                  className="rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-2 text-[11px] text-slate-700"
                >
                  {isAr ? n.bodyAr : n.bodyEn}
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default EducationalEquityPanel;
