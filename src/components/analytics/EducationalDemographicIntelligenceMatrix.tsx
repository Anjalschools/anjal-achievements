"use client";

import { useMemo } from "react";
import type { ParticipationActivityRow, ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";
import {
  buildDemographicMatrix,
  buildDemographicParticipationInsights,
  type DemographicMatrixRow,
} from "@/lib/analytics/analytics-demographic-intelligence";
import { formatParticipationCount, t, type AnalyticsLocale } from "@/lib/analytics/analytics-semantic-registry";
import DrillableMiniHBar from "@/components/analytics/DrillableMiniHBar";
import { useAnalyticsPerspective } from "@/lib/analytics/analytics-perspective-context";
import type { DrillChartSource } from "@/lib/analytics/analytics-drilldown-router";

export type EducationalDemographicIntelligenceMatrixProps = {
  isAr: boolean;
  data: ParticipationAnalyticsPayload;
  table: ParticipationActivityRow[];
  onDrill: (source: DrillChartSource, payload: { key?: string; labelAr?: string; labelEn?: string }) => void;
  drillHint: string;
};

const MatrixBlock = ({
  row,
  isAr,
  loc,
  max,
  onDrill,
  drillHint,
}: {
  row: DemographicMatrixRow;
  isAr: boolean;
  loc: AnalyticsLocale;
  max: number;
  onDrill: EducationalDemographicIntelligenceMatrixProps["onDrill"];
  drillHint: string;
}) => {
  const drillSource: DrillChartSource =
    row.dimension === "gender"
      ? "gender_bar"
      : row.dimension === "section"
        ? "section_bar"
        : row.dimension === "mawhiba"
          ? "mawhiba_bar"
          : "section_bar";

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
      <h4 className="text-xs font-black text-slate-800">
        {isAr ? row.dimensionLabelAr : row.dimensionLabelEn}
      </h4>
      <div className="mt-2 space-y-2">
        {row.slices.map((s) => (
          <DrillableMiniHBar
            key={s.key}
            label={isAr ? s.labelAr : s.labelEn}
            value={s.participations}
            max={max}
            isAr={isAr}
            suffix={isAr ? ` · ${s.conversionPct}% ميداليات` : ` · ${s.conversionPct}% medals`}
            drillLabel={drillHint}
            compact
            onDrill={() =>
              onDrill(drillSource, { key: s.key, labelAr: s.labelAr, labelEn: s.labelEn })
            }
          />
        ))}
      </div>
    </div>
  );
};

const EducationalDemographicIntelligenceMatrix = ({
  isAr,
  data,
  table,
  onDrill,
  drillHint,
}: EducationalDemographicIntelligenceMatrixProps) => {
  const { perspective, loc } = useAnalyticsPerspective();
  const matrix = useMemo(() => buildDemographicMatrix(data, table, perspective), [data, table, perspective]);
  const insights = useMemo(
    () => buildDemographicParticipationInsights(data, table, isAr),
    [data, table, isAr]
  );
  const globalMax = Math.max(1, ...matrix.flatMap((m) => m.slices.map((s) => s.participations)));

  return (
    <div className="space-y-4" dir={isAr ? "rtl" : "ltr"}>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {insights.slice(0, 4).map((ins) => (
          <div
            key={ins.id}
            className="rounded-xl border border-violet-100 bg-violet-50/30 px-3 py-2"
          >
            <p className="text-[10px] font-bold text-violet-900">
              {isAr ? ins.labelAr : ins.labelEn}
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-800">
              {isAr ? ins.metricAr : ins.metricEn}
            </p>
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {matrix.map((m) => (
          <MatrixBlock
            key={m.dimension}
            row={m}
            isAr={isAr}
            loc={loc}
            max={globalMax}
            onDrill={onDrill}
            drillHint={drillHint}
          />
        ))}
      </div>
      <p className="text-[10px] text-slate-500">
        {isAr
          ? `إجمالي النطاق: ${formatParticipationCount(data.kpis.totalParticipations, loc)} · ${data.kpis.distinctStudents} طالب`
          : `Scope total: ${formatParticipationCount(data.kpis.totalParticipations, loc)} · ${data.kpis.distinctStudents} students`}
      </p>
    </div>
  );
};

export default EducationalDemographicIntelligenceMatrix;
