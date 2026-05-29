"use client";

import { useMemo } from "react";
import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";
import type { AnalyticsInsightsBundle } from "@/lib/analytics/analytics-insights-engine";
import { buildOpportunityIntelligence } from "@/lib/analytics/analytics-opportunity-intelligence";
import { buildEquityIntelligence } from "@/lib/analytics/analytics-equity-intelligence";
import { buildEducationalRecommendations } from "@/lib/analytics/analytics-recommendation-engine";
import { prioritizeRecommendations } from "@/lib/analytics/recommendation-prioritization";
import { useAnalyticsPerspective } from "@/lib/analytics/analytics-perspective-context";
import { t } from "@/lib/analytics/analytics-semantic-registry";
import { formatScore } from "@/lib/analytics/analytics-number-formatting";

export type ExecutiveIntelligenceSummaryStripProps = {
  isAr: boolean;
  data: ParticipationAnalyticsPayload;
  insights: AnalyticsInsightsBundle;
};

const ExecutiveIntelligenceSummaryStrip = ({
  isAr,
  data,
  insights,
}: ExecutiveIntelligenceSummaryStripProps) => {
  const { perspective, loc } = useAnalyticsPerspective();

  const summary = useMemo(() => {
    const opp = buildOpportunityIntelligence(data, perspective);
    const equity = buildEquityIntelligence(data, perspective);
    const recBundle = buildEducationalRecommendations(data, perspective);
    const prioritized = prioritizeRecommendations(recBundle.recommendations);

    const risks = [
      ...opp.alerts.filter((a) => a.severity === "critical").slice(0, 2),
      ...opp.gaps.filter((g) => g.severity === "critical").slice(0, 1),
    ].slice(0, 3);

    const opportunities = opp.narratives.slice(0, 3);
    const topRecs = prioritized.executiveTop3;
    const topInsight = insights.insights[0];

    return { risks, opportunities, topRecs, topInsight, equity, opp };
  }, [data, perspective, insights]);

  return (
    <section
      id="intel-executive-summary-strip"
      className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/90 via-white to-violet-50/50 p-4 shadow-sm print:break-inside-avoid"
      dir={isAr ? "rtl" : "ltr"}
      aria-label={t("workspace.summary.title", loc)}
    >
      <h2 className="text-sm font-black text-slate-900">{t("workspace.summary.title", loc)}</h2>
      <div className="mt-3 grid gap-3 lg:grid-cols-6">
        <div className="lg:col-span-2">
          <p className="text-[10px] font-bold text-rose-800">{t("workspace.summary.risks", loc)}</p>
          <ul className="mt-1 space-y-1">
            {summary.risks.length === 0 ? (
              <li className="text-[10px] text-slate-500">{isAr ? "لا مخاطر حرجة" : "No critical risks"}</li>
            ) : (
              summary.risks.map((r, idx) => (
                <li key={`risk-${r.id}-${idx}`} className="text-[10px] text-slate-800">
                  {isAr ? ("titleAr" in r ? r.titleAr : r.labelAr) : "titleEn" in r ? r.titleEn : r.labelEn}
                </li>
              ))
            )}
          </ul>
        </div>
        <div className="lg:col-span-2">
          <p className="text-[10px] font-bold text-emerald-800">
            {t("workspace.summary.opportunities", loc)}
          </p>
          <ul className="mt-1 space-y-1">
            {summary.opportunities.map((o) => (
              <li key={o.id} className="text-[10px] text-slate-800">
                {isAr ? o.bodyAr : o.bodyEn}
              </li>
            ))}
          </ul>
        </div>
        <div className="lg:col-span-2">
          <p className="text-[10px] font-bold text-teal-800">
            {t("workspace.summary.recommendations", loc)}
          </p>
          <ul className="mt-1 space-y-1">
            {summary.topRecs.map((r) => (
              <li key={r.id} className="text-[10px] font-semibold text-slate-800">
                {isAr ? r.titleAr : r.titleEn}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-3 border-t border-indigo-100/80 pt-3">
        {summary.topInsight ? (
          <div className="min-w-[140px] flex-1 rounded-lg bg-white/80 px-2 py-1.5 ring-1 ring-slate-100">
            <p className="text-[9px] font-bold text-slate-500">{t("workspace.summary.topInsight", loc)}</p>
            <p className="text-[10px] font-semibold text-slate-800">
              {isAr ? summary.topInsight.titleAr : summary.topInsight.titleEn}
            </p>
          </div>
        ) : null}
        <div className="rounded-lg bg-indigo-50 px-2 py-1.5 ring-1 ring-indigo-100">
          <p className="text-[9px] font-bold text-indigo-800">{t("equity.score", loc)}</p>
          <p className="text-xs font-black tabular-nums">{formatScore(summary.equity.equityScore, loc)}</p>
        </div>
        <div className="rounded-lg bg-violet-50 px-2 py-1.5 ring-1 ring-violet-100">
          <p className="text-[9px] font-bold text-violet-800">{t("opportunity.score", loc)}</p>
          <p className="text-xs font-black tabular-nums">
            {formatScore(summary.opp.opportunityScore, loc)}
          </p>
        </div>
      </div>
    </section>
  );
};

export default ExecutiveIntelligenceSummaryStrip;
