"use client";

import { useMemo, useState } from "react";
import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";
import {
  buildEducationalRecommendations,
  type EducationalRecommendation,
  type RecommendationSeverity,
  type RecommendationUiCategory,
} from "@/lib/analytics/analytics-recommendation-engine";
import {
  prioritizeRecommendations,
  type RecommendationPriorityTier,
} from "@/lib/analytics/recommendation-prioritization";
import { buildRecommendationScoreExplanation } from "@/lib/analytics/analytics-explainable-scores";
import { useAnalyticsPerspective } from "@/lib/analytics/analytics-perspective-context";
import { useIntelligenceWorkspace } from "@/lib/analytics/intelligence-workspace-context";
import { t, type AnalyticsLocale } from "@/lib/analytics/analytics-semantic-registry";
import { formatPercentage, formatScore } from "@/lib/analytics/analytics-number-formatting";
import type { DrillChartSource } from "@/lib/analytics/analytics-drilldown-router";
import ExplainableScoreBreakdownPanel from "@/components/analytics/ExplainableScoreBreakdownPanel";
import IntensityHeatmapGrid from "@/components/analytics/IntensityHeatmapGrid";
import IntelligenceCollapsibleSection from "@/components/analytics/IntelligenceCollapsibleSection";

export type RecommendationIntelligencePanelProps = {
  isAr: boolean;
  data: ParticipationAnalyticsPayload;
  onDrill: (
    source: DrillChartSource,
    payload: { key?: string; labelAr?: string; labelEn?: string; activityKey?: string }
  ) => void;
  drillHint: string;
};

const severityStyles: Record<RecommendationSeverity, string> = {
  info: "border-slate-200 bg-slate-50/80",
  moderate: "border-amber-200 bg-amber-50/45",
  high: "border-orange-200 bg-orange-50/50",
  critical: "border-rose-200 bg-rose-50/55",
};

const severityBadge: Record<RecommendationSeverity, string> = {
  info: "bg-slate-500 text-white",
  moderate: "bg-amber-500 text-white",
  high: "bg-orange-600 text-white",
  critical: "bg-rose-600 text-white",
};

const categoryKey = (cat: RecommendationUiCategory): Parameters<typeof t>[0] => {
  const map: Record<RecommendationUiCategory, Parameters<typeof t>[0]> = {
    participation: "recommendation.category.participation",
    equity: "recommendation.category.equity",
    diversity: "recommendation.category.diversity",
    expansion: "recommendation.category.expansion",
    talent: "recommendation.category.talent",
    representation: "recommendation.category.representation",
  };
  return map[cat];
};

const tierKey = (tier: RecommendationPriorityTier): Parameters<typeof t>[0] => {
  const map: Record<RecommendationPriorityTier, Parameters<typeof t>[0]> = {
    critical_actions: "recommendation.tier.critical",
    high_impact: "recommendation.tier.high",
    medium_impact: "recommendation.tier.medium",
    informational: "recommendation.tier.info",
  };
  return map[tier];
};

const RecommendationCard = ({
  rec,
  isAr,
  loc,
  onDrill,
  drillHint,
  compact,
}: {
  rec: EducationalRecommendation;
  isAr: boolean;
  loc: AnalyticsLocale;
  onDrill: RecommendationIntelligencePanelProps["onDrill"];
  drillHint: string;
  compact?: boolean;
}) => (
  <button
    type="button"
    onClick={() => onDrill(rec.drillSource, rec.drillPayload)}
    className={`w-full rounded-xl border px-3 text-start transition hover:ring-2 hover:ring-teal-200 focus:outline-none focus:ring-2 focus:ring-teal-500 ${severityStyles[rec.severity]} ${compact ? "py-2" : "py-3"}`}
    title={rec.trace.confidenceExplanationAr}
  >
    <div className="flex flex-wrap items-center gap-2">
      <span className="rounded-md bg-white/90 px-1.5 py-0.5 text-[9px] font-bold text-slate-700">
        {t(categoryKey(rec.uiCategory), loc)}
      </span>
      <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase ${severityBadge[rec.severity]}`}>
        {t(`recommendation.severity.${rec.severity}` as Parameters<typeof t>[0], loc)}
      </span>
      <span className="text-[9px] font-semibold text-slate-500">
        {isAr ? "ثقة" : "Conf."} {formatPercentage(rec.confidence * 100, loc)}
      </span>
    </div>
    <p className={`mt-2 font-black text-slate-900 ${compact ? "text-[11px]" : "text-xs"}`}>
      {isAr ? rec.titleAr : rec.titleEn}
    </p>
    {!compact ? (
      <>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-800">
          {isAr ? rec.bodyAr : rec.bodyEn}
        </p>
        <p className="mt-1.5 text-[10px] text-slate-600">
          <span className="font-bold">{isAr ? "السبب:" : "Reason:"}</span>{" "}
          {isAr ? rec.reasonAr : rec.reasonEn}
        </p>
        {rec.supportingMetrics.length > 0 ? (
          <ul className="mt-2 space-y-0.5">
            {rec.supportingMetrics.slice(0, 2).map((m, i) => (
              <li key={i} className="text-[10px] text-slate-600">
                {isAr ? m.labelAr : m.labelEn}: {m.value}
              </li>
            ))}
          </ul>
        ) : null}
      </>
    ) : null}
    <p className="mt-2 text-[10px] font-semibold text-teal-700">{drillHint} ↳</p>
  </button>
);

const RecommendationIntelligencePanel = ({
  isAr,
  data,
  onDrill,
  drillHint,
}: RecommendationIntelligencePanelProps) => {
  const { perspective, loc } = useAnalyticsPerspective();
  const { maxRecommendationCards, expandHeatmaps, density } = useIntelligenceWorkspace();
  const [expandedClusters, setExpandedClusters] = useState<Record<string, boolean>>({});

  const bundle = useMemo(
    () => buildEducationalRecommendations(data, perspective),
    [data, perspective]
  );
  const prioritized = useMemo(
    () => prioritizeRecommendations(bundle.recommendations),
    [bundle.recommendations]
  );
  const scoreExplain = useMemo(
    () => buildRecommendationScoreExplanation(data, perspective),
    [data, perspective]
  );

  const tiers: RecommendationPriorityTier[] = [
    "critical_actions",
    "high_impact",
    "medium_impact",
    "informational",
  ];

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
            : c.gapFromFair >= 15
              ? ("warning" as const)
              : ("info" as const),
        drillSource: c.drillSource,
      })),
    [bundle.heatmap]
  );

  const defaultClusterOpen = density !== "executive";

  return (
    <div className="space-y-4" dir={isAr ? "rtl" : "ltr"}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="text-sm font-black text-slate-900">{t("recommendation.panel.title", loc)}</h3>
        <div className="flex flex-wrap gap-2">
          <div className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-1.5">
            <p className="text-[10px] font-bold text-teal-900">{t("recommendation.score", loc)}</p>
            <p className="text-lg font-black tabular-nums text-teal-950">
              {formatScore(bundle.recommendationScore, loc)}
            </p>
          </div>
          <ExplainableScoreBreakdownPanel
            isAr={isAr}
            loc={loc}
            titleKey="score.explain.recommendation"
            bundle={scoreExplain}
            accent="teal"
          />
        </div>
      </div>

      {prioritized.executiveTop3.length > 0 ? (
        <div className="rounded-xl border border-teal-300 bg-teal-50/40 p-3">
          <h4 className="text-[10px] font-black uppercase tracking-wide text-teal-900">
            {t("recommendation.executive.top3", loc)}
          </h4>
          <div className="mt-2 grid gap-2 lg:grid-cols-3">
            {prioritized.executiveTop3.map((rec) => (
              <RecommendationCard
                key={rec.id}
                rec={rec}
                isAr={isAr}
                loc={loc}
                onDrill={onDrill}
                drillHint={drillHint}
                compact={density === "executive"}
              />
            ))}
          </div>
        </div>
      ) : null}

      {bundle.narratives.length > 0 ? (
        <ul className="grid gap-2 sm:grid-cols-2">
          {bundle.narratives.slice(0, density === "executive" ? 2 : 4).map((n) => (
            <li
              key={n.id}
              className={`rounded-lg border px-3 py-2 text-[11px] ${severityStyles[n.severity]}`}
            >
              {isAr ? n.bodyAr : n.bodyEn}
            </li>
          ))}
        </ul>
      ) : null}

      {tiers.map((tier) => {
        const items = prioritized.byTier[tier].slice(0, maxRecommendationCards);
        if (items.length === 0) return null;
        return (
          <IntelligenceCollapsibleSection
            key={tier}
            id={`rec-tier-${tier}`}
            title={t(tierKey(tier), loc)}
            hint={`${items.length} ${isAr ? "توصية" : "items"}`}
            isAr={isAr}
            defaultOpen={tier === "critical_actions" || tier === "high_impact"}
            density={density === "executive" ? "executive" : "detailed"}
          >
            <div className="grid gap-2 sm:grid-cols-2">
              {items.map((rec) => (
                <RecommendationCard
                  key={rec.id}
                  rec={rec}
                  isAr={isAr}
                  loc={loc}
                  onDrill={onDrill}
                  drillHint={drillHint}
                  compact={density === "executive"}
                />
              ))}
            </div>
          </IntelligenceCollapsibleSection>
        );
      })}

      {prioritized.clusters.map((cluster) => {
        const open = expandedClusters[cluster.clusterId] ?? defaultClusterOpen;
        const visible = open ? cluster.items : cluster.items.slice(0, 2);
        return (
          <IntelligenceCollapsibleSection
            key={cluster.clusterId}
            id={`rec-cluster-${cluster.clusterId}`}
            title={isAr ? `مجموعة ${cluster.labelAr}` : `${cluster.labelEn} cluster`}
            isAr={isAr}
            defaultOpen={defaultClusterOpen}
            badge={String(cluster.items.length)}
          >
            <div className="grid gap-2 sm:grid-cols-2">
              {visible.slice(0, maxRecommendationCards).map((rec) => (
                <RecommendationCard
                  key={rec.id}
                  rec={rec}
                  isAr={isAr}
                  loc={loc}
                  onDrill={onDrill}
                  drillHint={drillHint}
                  compact
                />
              ))}
            </div>
            {cluster.items.length > 2 ? (
              <button
                type="button"
                className="mt-2 text-[10px] font-bold text-teal-700"
                onClick={() =>
                  setExpandedClusters((p) => ({
                    ...p,
                    [cluster.clusterId]: !open,
                  }))
                }
              >
                {open
                  ? isAr
                    ? "طي المجموعة"
                    : "Collapse cluster"
                  : isAr
                    ? `عرض ${cluster.items.length - 2} إضافية`
                    : `Show ${cluster.items.length - 2} more`}
              </button>
            ) : null}
          </IntelligenceCollapsibleSection>
        );
      })}

      {expandHeatmaps && heatCells.length > 0 ? (
        <IntensityHeatmapGrid
          isAr={isAr}
          loc={loc}
          cells={heatCells}
          titleKey="recommendation.heatmap.title"
          onDrill={onDrill}
          maxCells={density === "deep" ? 12 : 6}
          compact={density === "executive"}
        />
      ) : null}
    </div>
  );
};

export default RecommendationIntelligencePanel;
