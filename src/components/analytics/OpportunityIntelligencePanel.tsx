"use client";

import { useMemo } from "react";
import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";
import {
  buildOpportunityIntelligence,
  type OpportunityAlert,
  type OpportunityCategory,
  type OpportunitySeverity,
  type OpportunityTier,
} from "@/lib/analytics/analytics-opportunity-intelligence";
import { useAnalyticsPerspective } from "@/lib/analytics/analytics-perspective-context";
import { useIntelligenceWorkspace } from "@/lib/analytics/intelligence-workspace-context";
import { buildOpportunityScoreExplanation } from "@/lib/analytics/analytics-explainable-scores";
import { t, type AnalyticsLocale } from "@/lib/analytics/analytics-semantic-registry";
import { formatPercentage, formatScore } from "@/lib/analytics/analytics-number-formatting";
import ExplainableScoreBreakdownPanel from "@/components/analytics/ExplainableScoreBreakdownPanel";
import IntensityHeatmapGrid from "@/components/analytics/IntensityHeatmapGrid";
import type { DrillChartSource } from "@/lib/analytics/analytics-drilldown-router";

export type OpportunityIntelligencePanelProps = {
  isAr: boolean;
  data: ParticipationAnalyticsPayload;
  onDrill: (
    source: DrillChartSource,
    payload: { key?: string; labelAr?: string; labelEn?: string; activityKey?: string }
  ) => void;
  drillHint: string;
};

const severityStyles: Record<OpportunitySeverity, string> = {
  info: "border-indigo-200 bg-indigo-50/50",
  warning: "border-amber-200 bg-amber-50/45",
  critical: "border-rose-200 bg-rose-50/50",
};

const tierStyles: Record<OpportunityTier, string> = {
  excellent: "bg-emerald-100 text-emerald-900 ring-emerald-200",
  balanced: "bg-sky-100 text-sky-900 ring-sky-200",
  warning: "bg-amber-100 text-amber-950 ring-amber-200",
  critical: "bg-rose-100 text-rose-950 ring-rose-200",
};

const categoryLabel = (cat: OpportunityCategory, loc: AnalyticsLocale): string => {
  const map: Record<OpportunityCategory, Parameters<typeof t>[0]> = {
    access_gap: "opportunity.category.access_gap",
    representation_gap: "opportunity.category.representation_gap",
    participation_imbalance: "opportunity.category.participation_imbalance",
    opportunity_concentration: "opportunity.category.opportunity_concentration",
    diversity_warning: "opportunity.category.diversity_warning",
  };
  return t(map[cat], loc);
};

const tierLabel = (tier: OpportunityTier, loc: AnalyticsLocale): string => {
  const map: Record<OpportunityTier, Parameters<typeof t>[0]> = {
    excellent: "opportunity.tier.excellent",
    balanced: "opportunity.tier.balanced",
    warning: "opportunity.tier.warning",
    critical: "opportunity.tier.critical",
  };
  return t(map[tier], loc);
};

const AlertCard = ({
  alert,
  isAr,
  onDrill,
  drillHint,
  loc,
}: {
  alert: OpportunityAlert;
  isAr: boolean;
  onDrill: OpportunityIntelligencePanelProps["onDrill"];
  drillHint: string;
  loc: AnalyticsLocale;
}) => (
  <button
    type="button"
    onClick={() => onDrill(alert.drillSource, alert.drillPayload)}
    className={`w-full rounded-xl border px-3 py-2.5 text-start transition hover:ring-2 hover:ring-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 ${severityStyles[alert.severity]}`}
    title={alert.trace.aggregationBasis}
  >
    <div className="flex flex-wrap items-center gap-2">
      <span className="rounded-md bg-white/80 px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-600">
        {categoryLabel(alert.category, loc)}
      </span>
      <span
        className={`rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase ${
          alert.severity === "critical"
            ? "bg-rose-600 text-white"
            : alert.severity === "warning"
              ? "bg-amber-500 text-white"
              : "bg-indigo-500 text-white"
        }`}
      >
        {alert.severity}
      </span>
    </div>
    <p className="mt-1.5 text-xs font-black text-slate-900">{isAr ? alert.titleAr : alert.titleEn}</p>
    <p className="mt-1 text-[11px] leading-relaxed text-slate-700">
      {isAr ? alert.bodyAr : alert.bodyEn}
    </p>
    <p className="mt-1 text-[10px] font-semibold text-indigo-600">{drillHint} ↳</p>
  </button>
);

const OpportunityIntelligencePanel = ({
  isAr,
  data,
  onDrill,
  drillHint,
}: OpportunityIntelligencePanelProps) => {
  const { perspective, loc } = useAnalyticsPerspective();
  const { expandHeatmaps } = useIntelligenceWorkspace();
  const bundle = useMemo(
    () => buildOpportunityIntelligence(data, perspective),
    [data, perspective]
  );
  const scoreExplain = useMemo(
    () => buildOpportunityScoreExplanation(data, perspective),
    [data, perspective]
  );

  const heatCells = useMemo(
    () =>
      bundle.heatmap.map((c) => ({
        key: `${c.dimension}-${c.key}`,
        labelAr: c.labelAr,
        labelEn: c.labelEn,
        intensity: c.intensity,
        sharePct: c.sharePct,
        gapFromFair: c.gapFromFair,
        severity:
          c.gapFromFair >= 25
            ? ("critical" as const)
            : c.gapFromFair >= 18
              ? ("warning" as const)
              : ("info" as const),
        drillSource: c.drillSource,
      })),
    [bundle.heatmap]
  );

  const alertsByCategory = useMemo(() => {
    const m = new Map<OpportunityCategory, OpportunityAlert[]>();
    for (const a of bundle.alerts) {
      const list = m.get(a.category) ?? [];
      list.push(a);
      m.set(a.category, list);
    }
    return m;
  }, [bundle.alerts]);

  return (
    <div className="space-y-5" dir={isAr ? "rtl" : "ltr"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-black text-slate-900">{t("opportunity.panel.title", loc)}</h3>
        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-1.5">
            <p className="text-[10px] font-bold text-violet-900">{t("opportunity.score", loc)}</p>
            <p className="text-lg font-black tabular-nums text-violet-950">
              {formatScore(bundle.opportunityScore, loc)}
            </p>
          </div>
          <ExplainableScoreBreakdownPanel
            isAr={isAr}
            loc={loc}
            titleKey="score.explain.opportunity"
            bundle={scoreExplain}
            accent="violet"
          />
          <span
            className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ring-1 ${tierStyles[bundle.tier]}`}
          >
            {tierLabel(bundle.tier, loc)}
          </span>
        </div>
      </div>

      {/* Alerts by category */}
      <div className="space-y-3">
        {([...alertsByCategory.entries()] as Array<[OpportunityCategory, OpportunityAlert[]]>).map(
          ([cat, items]) =>
            items.length > 0 ? (
              <div key={cat}>
                <h4 className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                  {categoryLabel(cat, loc)}
                </h4>
                <div className="grid gap-2 sm:grid-cols-2">
                  {items.slice(0, 4).map((alert) => (
                    <AlertCard
                      key={alert.id}
                      alert={alert}
                      isAr={isAr}
                      onDrill={onDrill}
                      drillHint={drillHint}
                      loc={loc}
                    />
                  ))}
                </div>
              </div>
            ) : null
        )}
      </div>

      {expandHeatmaps && heatCells.length > 0 ? (
        <IntensityHeatmapGrid
          isAr={isAr}
          loc={loc}
          cells={heatCells}
          titleKey="opportunity.heatmap.title"
          onDrill={onDrill}
          maxCells={12}
        />
      ) : null}

      {/* Distribution charts */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
          <h4 className="text-xs font-black text-slate-800">
            {isAr ? "انتشار المشاركات" : "Participation spread"}
          </h4>
          <p className="mt-2 text-2xl font-black tabular-nums text-indigo-900">
            {formatPercentage(bundle.spread.participationSpread, loc)}
          </p>
          <p className="text-[10px] text-slate-500">
            {isAr
              ? `${bundle.spread.activityCount} نشاط · ${bundle.spread.levelCount} مستوى`
              : `${bundle.spread.activityCount} activities · ${bundle.spread.levelCount} levels`}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
          <h4 className="text-xs font-black text-slate-800">
            {isAr ? "توازن الفرص" : "Opportunity balance"}
          </h4>
          <ul className="mt-2 space-y-1">
            {bundle.gaps.slice(0, 4).map((g) => (
              <li key={g.id} className="text-[11px] text-slate-700">
                {isAr ? g.labelAr : g.labelEn}: {g.gapValue}
                {g.kind.includes("gap") ? "%" : ""}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Concentration */}
      <div className="rounded-xl border border-orange-100 bg-orange-50/30 p-3">
        <h4 className="text-xs font-black text-orange-950">{t("opportunity.concentration.title", loc)}</h4>
        <ul className="mt-2 space-y-2">
          {bundle.concentrations.slice(0, 4).map((c) => (
            <li key={c.activityKey}>
              <button
                type="button"
                onClick={() =>
                  onDrill("activity_row", {
                    activityKey: c.activityKey,
                    key: c.activityKey,
                    labelAr: c.labelAr,
                    labelEn: c.labelEn,
                  })
                }
                className="w-full rounded-lg border border-white/80 bg-white px-2.5 py-2 text-start hover:ring-2 hover:ring-orange-200"
              >
                <p className="text-[11px] font-bold text-slate-900">
                  {isAr ? c.labelAr : c.labelEn} · {c.dominantPct}%
                </p>
                <p className="mt-0.5 text-[10px] text-slate-600">
                  {isAr ? c.narrativeAr : c.narrativeEn}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Recommendations */}
      <div className="rounded-xl border border-teal-100 bg-teal-50/35 p-3">
        <h4 className="text-xs font-black text-teal-950">
          {t("opportunity.recommendations.title", loc)}
        </h4>
        <ul className="mt-2 space-y-2">
          {bundle.recommendations.map((r) => (
            <li
              key={r.id}
              className="rounded-lg border border-teal-100/80 bg-white px-2.5 py-2 text-[11px] text-slate-800"
            >
              {isAr ? r.bodyAr : r.bodyEn}
            </li>
          ))}
        </ul>
      </div>

      {bundle.narratives.length > 0 ? (
        <ul className="grid gap-2 sm:grid-cols-2">
          {bundle.narratives.map((n) => (
            <li
              key={n.id}
              className={`rounded-lg border px-3 py-2 text-[11px] ${severityStyles[n.severity]}`}
            >
              {isAr ? n.bodyAr : n.bodyEn}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};

export default OpportunityIntelligencePanel;
