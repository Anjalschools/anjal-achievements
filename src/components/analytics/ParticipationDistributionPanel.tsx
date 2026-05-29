"use client";

import { useMemo } from "react";
import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";
import { buildParticipationDistributions } from "@/lib/analytics/analytics-demographic-intelligence";
import { t, type AnalyticsLocale } from "@/lib/analytics/analytics-semantic-registry";
import DrillableMiniHBar from "@/components/analytics/DrillableMiniHBar";
import { useAnalyticsPerspective } from "@/lib/analytics/analytics-perspective-context";
import { scaleSliceToPerspective } from "@/lib/analytics/analytics-perspective";
import type { DrillChartSource } from "@/lib/analytics/analytics-drilldown-router";

export type ParticipationDistributionPanelProps = {
  isAr: boolean;
  data: ParticipationAnalyticsPayload;
  onDrill: (source: DrillChartSource, payload: { key?: string; labelAr?: string; labelEn?: string }) => void;
  drillHint: string;
};

const ParticipationDistributionPanel = ({
  isAr,
  data,
  onDrill,
  drillHint,
}: ParticipationDistributionPanelProps) => {
  const { perspective, loc } = useAnalyticsPerspective();
  const dist = useMemo(() => buildParticipationDistributions(data), [data]);

  const blocks: Array<{
    title: string;
    dim: keyof typeof dist;
    source: DrillChartSource;
  }> = [
    { title: t("dim.section", loc), dim: "section", source: "section_bar" },
    { title: t("dim.gender", loc), dim: "gender", source: "gender_bar" },
    { title: t("dim.mawhiba", loc), dim: "mawhiba", source: "mawhiba_bar" },
    { title: t("dim.level", loc), dim: "level", source: "section_bar" },
    { title: t("dim.stage", loc), dim: "stage", source: "section_bar" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" dir={isAr ? "rtl" : "ltr"}>
      {blocks.map(({ title, dim, source }) => {
        const rows = dist[dim];
        const scaled = rows.map((r) => ({
          ...r,
          count: scaleSliceToPerspective(r.count, data, perspective),
        }));
        const max = Math.max(1, ...scaled.map((r) => r.count));
        return (
          <div key={dim} className="rounded-xl border border-slate-200 bg-white p-3">
            <h4 className="text-xs font-black text-slate-800">{title}</h4>
            <div className="mt-2 space-y-2">
              {rows.length === 0 ? (
                <p className="text-[11px] text-slate-500">{isAr ? "لا بيانات" : "No data"}</p>
              ) : (
                scaled.map((r) => (
                  <DrillableMiniHBar
                    key={r.key}
                    label={isAr ? r.labelAr : r.labelEn}
                    value={r.count}
                    max={max}
                    isAr={isAr}
                    drillLabel={drillHint}
                    compact
                    onDrill={() =>
                      onDrill(source, { key: r.key, labelAr: r.labelAr, labelEn: r.labelEn })
                    }
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ParticipationDistributionPanel;
