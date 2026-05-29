"use client";

import { useMemo } from "react";
import type { HistoricalTrendIntelligence } from "@/lib/analytics/historical-trend-intelligence";
import { formatLocalizedNumber } from "@/lib/analytics/analytics-number-formatting";
import { formatExecutiveCagr } from "@/lib/analytics/ai/executive-intelligence/executive-wording-engine";
import type { AnalyticsLocale } from "@/lib/analytics/analytics-semantic-registry";

export type HistoricalTimelineInsightsProps = {
  isAr: boolean;
  trend: HistoricalTrendIntelligence;
  compact?: boolean;
};

const markerTone = (semantic: HistoricalTrendIntelligence["semantic"]): string => {
  if (semantic === "accelerating" || semantic === "recovery") return "border-emerald-400 bg-emerald-50 text-emerald-900";
  if (semantic === "declining") return "border-rose-400 bg-rose-50 text-rose-900";
  if (semantic === "volatile") return "border-amber-400 bg-amber-50 text-amber-900";
  return "border-slate-300 bg-slate-50 text-slate-800";
};

const HistoricalTimelineInsights = ({ isAr, trend, compact = false }: HistoricalTimelineInsightsProps) => {
  const loc: AnalyticsLocale = isAr ? "ar" : "en";
  const cagrPresentation = formatExecutiveCagr(trend.cagr, trend.series.length, {
    locale: loc,
  });
  const maxVal = useMemo(
    () => Math.max(1, ...trend.series.map((p) => p.value)),
    [trend.series]
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3" dir={isAr ? "rtl" : "ltr"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-black text-slate-900">
          {isAr ? trend.scope.labelAr : trend.scope.labelEn}
        </h4>
        <span className={`rounded-md border px-2 py-0.5 text-[9px] font-bold ${markerTone(trend.semantic)}`}>
          {trend.semantic === "accelerating"
            ? isAr
              ? "تسارع"
              : "Accelerating"
            : trend.semantic === "declining"
              ? isAr
                ? "تراجع"
                : "Declining"
              : trend.semantic === "volatile"
                ? isAr
                  ? "تقلب"
                  : "Volatile"
                : trend.semantic === "recovery"
                  ? isAr
                    ? "تعافٍ"
                    : "Recovery"
                  : isAr
                    ? "استقرار"
                    : "Stable"}
        </span>
      </div>

      {!compact ? (
        <div className="mt-3 flex items-end gap-1 overflow-x-auto pb-1">
          {trend.series.map((point) => {
            const h = Math.max(8, Math.round((point.value / maxVal) * 48));
            const isPeak = point.year === trend.peaks.bestYear;
            const isLow = point.year === trend.peaks.worstYear;
            return (
              <div key={point.year} className="flex min-w-[36px] flex-col items-center gap-1">
                <span className="text-[8px] font-bold tabular-nums text-slate-600">
                  {formatLocalizedNumber(point.value, loc, 0)}
                </span>
                <div
                  className={`w-6 rounded-t ${isPeak ? "bg-emerald-500" : isLow ? "bg-rose-400" : "bg-indigo-300"}`}
                  style={{ height: h }}
                  title={
                    isPeak
                      ? isAr
                        ? "ذروة"
                        : "Peak"
                      : isLow
                        ? isAr
                          ? "أدنى"
                          : "Low"
                        : undefined
                  }
                />
                <span className="text-[9px] font-bold text-slate-700">{point.year}</span>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="mt-3 grid gap-2 text-[10px] sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg bg-slate-50 px-2 py-1.5">
          <span className="font-bold text-slate-500">CAGR</span>
          <p className="font-black tabular-nums text-slate-900" title={cagrPresentation.exploratory ? (isAr ? "اتجاه أولي" : "Early trend") : undefined}>
            {cagrPresentation.display.split(" · ")[0]}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 px-2 py-1.5">
          <span className="font-bold text-slate-500">{isAr ? "زخم" : "Momentum"}</span>
          <p className="font-black tabular-nums text-slate-900">{trend.momentum}</p>
        </div>
        <div className="rounded-lg bg-slate-50 px-2 py-1.5">
          <span className="font-bold text-slate-500">{isAr ? "اتساق" : "Consistency"}</span>
          <p className="font-black tabular-nums text-slate-900">
            {trend.consistency.overall}/100
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 px-2 py-1.5">
          <span className="font-bold text-slate-500">{isAr ? "ذروة" : "Peak"}</span>
          <p className="font-black text-slate-900">{trend.peaks.bestYear}</p>
        </div>
      </div>

      <ul className="mt-2 flex flex-wrap gap-1 text-[9px] text-slate-600">
        <li className="rounded bg-emerald-100 px-1.5 py-0.5">
          {isAr ? `قفزة: ${trend.peaks.largestJumpYear}` : `Jump: ${trend.peaks.largestJumpYear}`}
        </li>
        <li className="rounded bg-rose-100 px-1.5 py-0.5">
          {isAr ? `انخفاض: ${trend.peaks.largestDropYear}` : `Drop: ${trend.peaks.largestDropYear}`}
        </li>
        <li className="rounded bg-sky-100 px-1.5 py-0.5">
          {isAr ? `استقرار: ${trend.peaks.mostStableYear}` : `Stable: ${trend.peaks.mostStableYear}`}
        </li>
        <li className="rounded bg-indigo-100 px-1.5 py-0.5">
          {isAr ? `تحول: ${trend.peaks.inflectionYear}` : `Inflection: ${trend.peaks.inflectionYear}`}
        </li>
      </ul>
    </div>
  );
};

export default HistoricalTimelineInsights;
