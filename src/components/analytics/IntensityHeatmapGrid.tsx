"use client";

import { useMemo } from "react";
import { formatPercentage } from "@/lib/analytics/analytics-number-formatting";
import type { AnalyticsLocale } from "@/lib/analytics/analytics-semantic-registry";
import { t } from "@/lib/analytics/analytics-semantic-registry";
import type { DrillChartSource } from "@/lib/analytics/analytics-drilldown-router";

export type HeatmapCellInput = {
  key: string;
  labelAr: string;
  labelEn: string;
  intensity: number;
  sharePct: number;
  gapFromFair?: number;
  severity?: "info" | "warning" | "critical" | "moderate";
  drillSource?: DrillChartSource;
};

const intensityToBg = (intensity: number, severity?: HeatmapCellInput["severity"]): string => {
  if (severity === "critical" || intensity >= 75) {
    return "bg-gradient-to-br from-rose-500 to-rose-700 text-white";
  }
  if (severity === "warning" || severity === "moderate" || intensity >= 50) {
    return "bg-gradient-to-br from-amber-400 to-orange-500 text-amber-950";
  }
  if (intensity >= 28) {
    return "bg-gradient-to-br from-sky-300 to-indigo-400 text-indigo-950";
  }
  return "bg-gradient-to-br from-slate-100 to-slate-200 text-slate-700";
};

export type IntensityHeatmapGridProps = {
  isAr: boolean;
  loc: AnalyticsLocale;
  cells: HeatmapCellInput[];
  titleKey?: Parameters<typeof t>[0];
  onDrill?: (
    source: DrillChartSource,
    payload: { key?: string; labelAr?: string; labelEn?: string; activityKey?: string }
  ) => void;
  maxCells?: number;
  compact?: boolean;
};

const IntensityHeatmapGrid = ({
  isAr,
  loc,
  cells,
  titleKey,
  onDrill,
  maxCells = 12,
  compact = false,
}: IntensityHeatmapGridProps) => {
  const sorted = useMemo(
    () => [...cells].sort((a, b) => b.intensity - a.intensity).slice(0, maxCells),
    [cells, maxCells]
  );

  if (sorted.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3" dir={isAr ? "rtl" : "ltr"}>
      {titleKey ? (
        <h4 className="text-xs font-black text-slate-800">{t(titleKey, loc)}</h4>
      ) : null}
      <div
        className={`mt-3 grid gap-2 ${compact ? "grid-cols-3 sm:grid-cols-4" : "sm:grid-cols-3 lg:grid-cols-4"}`}
      >
        {sorted.map((c) => {
          const Wrapper = onDrill && c.drillSource ? "button" : "div";
          const bg = intensityToBg(c.intensity, c.severity);
          return (
            <Wrapper
              key={c.key}
              type={onDrill && c.drillSource ? "button" : undefined}
              onClick={
                onDrill && c.drillSource
                  ? () =>
                      onDrill(c.drillSource!, {
                        key: c.key,
                        labelAr: c.labelAr,
                        labelEn: c.labelEn,
                      })
                  : undefined
              }
              className={`rounded-lg px-2 py-2 text-start transition ${bg} ${
                onDrill && c.drillSource ? "hover:ring-2 hover:ring-white/60 focus:outline-none focus:ring-2" : ""
              } ${compact ? "min-h-[52px]" : "min-h-[64px]"}`}
            >
              <p className={`font-bold leading-tight ${compact ? "text-[9px]" : "text-[10px]"}`}>
                {isAr ? c.labelAr : c.labelEn}
              </p>
              <p className={`mt-1 tabular-nums font-black ${compact ? "text-[10px]" : "text-xs"}`}>
                {formatPercentage(c.intensity, loc)}
              </p>
              {typeof c.gapFromFair === "number" ? (
                <p className={`opacity-90 ${compact ? "text-[8px]" : "text-[9px]"}`}>
                  {isAr ? "فجوة" : "gap"} {formatPercentage(c.gapFromFair, loc, { compact: true })}
                </p>
              ) : null}
            </Wrapper>
          );
        })}
      </div>
    </div>
  );
};

export default IntensityHeatmapGrid;
