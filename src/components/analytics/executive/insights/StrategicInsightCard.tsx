"use client";

import { memo } from "react";
import type { ExecutiveSemanticInsight } from "@/lib/analytics/intelligence/analytics-narrative-schema";
import {
  impactScorePercent,
  resolveInsightCardType,
} from "@/lib/analytics/intelligence/analytics-insight-card-type";
import StrategicInsightSeverityBadge from "@/components/analytics/executive/insights/StrategicInsightSeverityBadge";
import StrategicInsightConfidenceBar from "@/components/analytics/executive/insights/StrategicInsightConfidenceBar";
import StrategicInsightEvidencePanel from "@/components/analytics/executive/insights/StrategicInsightEvidencePanel";
import StrategicInsightRecommendationList from "@/components/analytics/executive/insights/StrategicInsightRecommendationList";
import StrategicInsightTimeline from "@/components/analytics/executive/insights/StrategicInsightTimeline";

const CARD_BORDER: Record<string, string> = {
  opportunity: "border-emerald-200 hover:border-emerald-300",
  warning: "border-amber-200 hover:border-amber-300",
  critical: "border-rose-200 hover:border-rose-300",
  stability: "border-sky-200 hover:border-sky-300",
  growth: "border-teal-200 hover:border-teal-300",
  decline: "border-orange-200 hover:border-orange-300",
  equity: "border-violet-200 hover:border-violet-300",
  recommendation: "border-indigo-200 hover:border-indigo-300",
  exploratory: "border-dashed border-amber-300 hover:border-amber-400",
};

const CARD_BG: Record<string, string> = {
  opportunity: "bg-emerald-50/40",
  warning: "bg-amber-50/40",
  critical: "bg-rose-50/40",
  stability: "bg-sky-50/30",
  growth: "bg-teal-50/40",
  decline: "bg-orange-50/40",
  equity: "bg-violet-50/40",
  recommendation: "bg-indigo-50/30",
  exploratory: "bg-amber-50/20 opacity-95",
};

export type StrategicInsightCardProps = {
  isAr: boolean;
  insight: ExecutiveSemanticInsight;
};

const StrategicInsightCard = memo(({ isAr, insight }: StrategicInsightCardProps) => {
  const cardType = resolveInsightCardType(insight);
  const impactPct = impactScorePercent(insight.impact);
  const lowConfidence = insight.confidence === "LOW" || insight.confidence === "EXPLORATORY";
  const title = isAr ? insight.titleAr : insight.titleEn;
  const summary = isAr ? insight.descriptionAr : insight.descriptionEn;
  const meaning = insight.strategicMeaning;

  return (
    <article
      className={`group flex flex-col gap-3 rounded-2xl border p-4 shadow-sm transition hover:shadow-md ${CARD_BORDER[cardType]} ${CARD_BG[cardType]} ${
        lowConfidence ? "opacity-90 saturate-75" : ""
      }`}
      dir={isAr ? "rtl" : "ltr"}
      aria-labelledby={`insight-${insight.id}-title`}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h4 id={`insight-${insight.id}-title`} className="text-xs font-black text-slate-900">
            {title}
          </h4>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-700">{summary}</p>
        </div>
        <StrategicInsightSeverityBadge isAr={isAr} severity={insight.severity} cardType={cardType} />
      </header>

      <StrategicInsightConfidenceBar isAr={isAr} confidence={insight.confidence} />

      <div className="flex flex-wrap items-center gap-2 text-[9px] font-bold text-slate-600">
        <span className="rounded-md bg-white/80 px-2 py-0.5 ring-1 ring-slate-200">
          {isAr ? "الأثر" : "Impact"}: {impactPct}%
        </span>
        {insight.affectedDimensions.slice(0, 2).map((m) => (
          <span key={m} className="rounded-md bg-white/70 px-2 py-0.5 ring-1 ring-slate-100">
            {m}
          </span>
        ))}
        {cardType === "exploratory" ? (
          <span className="rounded-md border border-dashed border-amber-400 bg-amber-50 px-2 py-0.5 text-amber-900">
            {isAr ? "تجريبي" : "Experimental"}
          </span>
        ) : null}
      </div>

      <StrategicInsightTimeline
        isAr={isAr}
        historicalSupport={insight.historicalSupport}
        impactPercent={impactPct}
      />

      <p className="text-[10px] leading-snug text-slate-600">
        <span className="font-black text-slate-800">{isAr ? "المعنى الاستراتيجي: " : "Strategic meaning: "}</span>
        {meaning}
      </p>

      <StrategicInsightEvidencePanel isAr={isAr} evidence={insight.evidence} />
      <StrategicInsightRecommendationList isAr={isAr} recommendation={insight.recommendation} />
    </article>
  );
});

StrategicInsightCard.displayName = "StrategicInsightCard";

export default StrategicInsightCard;
