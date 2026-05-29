"use client";

import { useMemo } from "react";
import type { ExecutiveNarrative } from "@/lib/analytics/analytics-narrative-engine";
import { buildStrategicSemanticInsights } from "@/lib/analytics/intelligence/analytics-strategic-narrative-engine";
import { t, type AnalyticsLocale } from "@/lib/analytics/analytics-semantic-registry";
import { useAnalyticsPerspectiveOptional } from "@/lib/analytics/analytics-perspective-context";
import StrategicInsightGrid from "@/components/analytics/executive/insights/StrategicInsightGrid";

export type ExecutiveNarrativesPanelProps = {
  isAr: boolean;
  narratives: ExecutiveNarrative[];
  exploratoryMode?: boolean;
  filterCount?: number;
  maxCards?: number;
};

const ExecutiveNarrativesPanel = ({
  isAr,
  narratives,
  exploratoryMode,
  filterCount,
  maxCards = 12,
}: ExecutiveNarrativesPanelProps) => {
  const loc: AnalyticsLocale = isAr ? "ar" : "en";
  const perspectiveCtx = useAnalyticsPerspectiveOptional();

  const insights = useMemo(
    () =>
      buildStrategicSemanticInsights({
        narratives,
        exploratoryMode,
        maxCards,
      }),
    [narratives, exploratoryMode, maxCards]
  );

  if (narratives.length === 0 && insights.length === 0) return null;

  return (
    <section
      id="exec-strategic-insights"
      className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      dir={isAr ? "rtl" : "ltr"}
      aria-labelledby="exec-narratives-title"
    >
      <h3 id="exec-narratives-title" className="text-sm font-black text-slate-900">
        {t("section.narrativeInsights", loc)}
      </h3>
      <p className="mt-0.5 text-[10px] text-slate-500">
        {isAr
          ? "رؤى استراتيجية مبنية على محرك الذكاء التنفيذي — ليست نصوصًا خامًا"
          : "Strategic insights from the executive semantic engine — not raw narrative text"}
      </p>
      {perspectiveCtx ? (
        <p className="mt-0.5 text-[10px] text-slate-500">{perspectiveCtx.description}</p>
      ) : null}
      <div className="mt-4">
        <StrategicInsightGrid isAr={isAr} insights={insights} filterCount={filterCount} />
      </div>
    </section>
  );
};

export default ExecutiveNarrativesPanel;
