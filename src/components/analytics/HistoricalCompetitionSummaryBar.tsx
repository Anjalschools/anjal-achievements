"use client";

import { memo } from "react";
import type { CompetitionResultsSummary } from "@/lib/analytics/historical-results-summary";
import { formatLocalizedNumber, formatPercentage } from "@/lib/analytics/analytics-number-formatting";

export type HistoricalCompetitionSummaryBarProps = {
  isAr: boolean;
  summary: CompetitionResultsSummary | null;
};

const HistoricalCompetitionSummaryBar = ({ isAr, summary }: HistoricalCompetitionSummaryBarProps) => {
  if (!summary) return null;
  const loc = isAr ? "ar" : "en";

  const items: Array<{
    label: string;
    value: string;
    confidence?: number;
    tone?: "indigo" | "amber" | "emerald" | "violet" | "rose";
  }> = [
    {
      label: isAr ? "أفضل نشاط تاريخيًا" : "Best historical activity",
      value: isAr ? summary.bestActivityAr : summary.bestActivityEn,
      tone: "indigo",
    },
    {
      label: isAr ? "أعلى معدل تتويج" : "Highest award rate",
      value:
        summary.highestAwardRate != null
          ? formatPercentage(summary.highestAwardRate, loc)
          : "—",
      confidence: summary.globalConfidence,
      tone: "amber",
    },
    {
      label: isAr ? "نشاط التتويج الأبرز" : "Top award activity",
      value: isAr ? summary.bestAwardRateActivityAr : summary.bestAwardRateActivityEn,
      tone: "amber",
    },
    {
      label: isAr ? "الأكثر استقرارًا" : "Most stable",
      value: isAr ? summary.mostStableActivityAr : summary.mostStableActivityEn,
      tone: "violet",
    },
    {
      label: isAr ? "أسرع نمو" : "Fastest growth",
      value: isAr ? summary.fastestGrowthLabelAr : summary.fastestGrowthLabelEn,
      tone: "emerald",
    },
    {
      label: isAr ? "سنة الذروة العامة" : "Global peak year",
      value: summary.globalPeakYear ? String(summary.globalPeakYear) : "—",
      tone: "emerald",
    },
    {
      label: isAr ? "سنة الانخفاض" : "Decline year",
      value: summary.globalDeclineYear ? String(summary.globalDeclineYear) : "—",
      tone: "rose",
    },
  ];

  const toneClass = (tone?: string) => {
    if (tone === "amber") return "border-amber-200 from-amber-50/90";
    if (tone === "emerald") return "border-emerald-200 from-emerald-50/90";
    if (tone === "violet") return "border-violet-200 from-violet-50/90";
    if (tone === "rose") return "border-rose-200 from-rose-50/90";
    return "border-indigo-200 from-indigo-50/90";
  };

  return (
    <div
      className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      dir={isAr ? "rtl" : "ltr"}
      role="region"
      aria-label={isAr ? "رؤى عالمية لنتائج المسابقات" : "Global competition insights"}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className={`rounded-xl border bg-gradient-to-b to-white px-3 py-2 ${toneClass(item.tone)}`}
        >
          <p className="text-[9px] font-bold uppercase tracking-wide text-slate-600">
            {item.label}
          </p>
          <p className="mt-0.5 truncate text-sm font-black text-slate-900 tabular-nums">
            {item.value}
          </p>
          {item.confidence != null && item.confidence > 0 ? (
            <p className="mt-0.5 text-[9px] font-medium text-slate-500">
              {isAr ? "ثقة" : "Confidence"}: {formatLocalizedNumber(item.confidence, loc, 0)}%
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
};

export default memo(HistoricalCompetitionSummaryBar);
