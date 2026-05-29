"use client";

import { useMemo, useState } from "react";
import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";
import {
  buildComparisonWorkspace,
  COMPARISON_KIND_OPTIONS,
  comparisonPerspectiveMetric,
  formatDeltaIndicator,
  type ComparisonKind,
} from "@/lib/analytics/analytics-comparison-mode";
import { buildOpportunityComparisonDeltas } from "@/lib/analytics/analytics-opportunity-intelligence";
import { buildRecommendationComparisonDeltas } from "@/lib/analytics/analytics-recommendation-engine";
import { useAnalyticsPerspective } from "@/lib/analytics/analytics-perspective-context";
import { t } from "@/lib/analytics/analytics-semantic-registry";
import { formatPercentage, formatSignedDelta } from "@/lib/analytics/analytics-number-formatting";
import type { DrillChartSource } from "@/lib/analytics/analytics-drilldown-router";

export type AnalyticsComparisonWorkspaceProps = {
  isAr: boolean;
  data: ParticipationAnalyticsPayload;
  filterHash?: string;
  onDrill?: (source: DrillChartSource, payload: { key?: string; labelAr?: string; labelEn?: string }) => void;
};

const DeltaBadge = ({
  delta,
  isAr,
}: {
  delta: ReturnType<typeof formatDeltaIndicator>;
  isAr: boolean;
}) => (
  <span
    className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-black tabular-nums ${
      delta.tone === "gain"
        ? "bg-emerald-100 text-emerald-800"
        : delta.tone === "loss"
          ? "bg-rose-100 text-rose-800"
          : "bg-slate-100 text-slate-600"
    }`}
  >
    {delta.text}
  </span>
);

const SidePanel = ({
  label,
  metric,
  participations,
  students,
  medals,
  conversionPct,
  isAr,
  onDrill,
  drillKey,
  dominant,
  loc,
}: {
  label: string;
  metric: number;
  participations: number;
  students: number;
  medals: number;
  conversionPct: number;
  isAr: boolean;
  onDrill?: () => void;
  drillKey?: string;
  dominant?: boolean;
  loc: "ar" | "en";
}) => (
  <button
    type="button"
    onClick={onDrill}
    disabled={!onDrill}
    className={`rounded-xl border p-4 text-start transition ${
      dominant
        ? "border-emerald-300 bg-emerald-50/70 ring-2 ring-emerald-200"
        : "border-slate-200 bg-slate-50/60"
    } ${onDrill ? "hover:ring-2 hover:ring-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-400" : ""}`}
    aria-label={label}
    data-drill-key={drillKey}
  >
    {dominant ? (
      <span className="mb-1 inline-block rounded-md bg-emerald-600 px-1.5 py-0.5 text-[9px] font-black text-white">
        {t("comparison.dominant", loc)}
      </span>
    ) : null}
    <p className="text-xs font-black text-slate-800">{label}</p>
    <p className="mt-2 text-2xl font-black tabular-nums text-indigo-900">{metric}</p>
    <dl className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-slate-600">
      <div>
        <dt>{isAr ? "مشاركات" : "Participations"}</dt>
        <dd className="font-bold tabular-nums text-slate-800">{participations}</dd>
      </div>
      <div>
        <dt>{isAr ? "طلاب" : "Students"}</dt>
        <dd className="font-bold tabular-nums text-slate-800">{students}</dd>
      </div>
      <div>
        <dt>{isAr ? "ميداليات" : "Medals"}</dt>
        <dd className="font-bold tabular-nums text-slate-800">{medals}</dd>
      </div>
      <div>
        <dt>{isAr ? "تحويل %" : "Conversion %"}</dt>
        <dd className="font-bold tabular-nums text-slate-800">{formatPercentage(conversionPct, loc)}</dd>
      </div>
    </dl>
  </button>
);

const AnalyticsComparisonWorkspace = ({
  isAr,
  data,
  onDrill,
}: AnalyticsComparisonWorkspaceProps) => {
  const { perspective, loc } = useAnalyticsPerspective();
  const [kind, setKind] = useState<ComparisonKind>("section");

  const bundle = useMemo(
    () => buildComparisonWorkspace(data, kind, perspective),
    [data, kind, perspective]
  );

  const drillForKind = (sideKey: string, labelAr: string, labelEn: string) => {
    if (!onDrill) return undefined;
    const source: DrillChartSource =
      kind === "gender"
        ? "gender_bar"
        : kind === "section"
          ? "section_bar"
          : kind === "mawhiba"
            ? "mawhiba_bar"
            : kind === "activity" || kind === "competition"
              ? "activity_row"
              : "section_bar";
    return () => onDrill(source, { key: sideKey, labelAr, labelEn });
  };

  if (!bundle) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-xs text-slate-500">
        {isAr ? "لا توجد بيانات كافية لهذا النوع من المقارنة." : "Not enough data for this comparison type."}
      </p>
    );
  }

  const metricA = comparisonPerspectiveMetric(bundle.sideA, perspective);
  const metricB = comparisonPerspectiveMetric(bundle.sideB, perspective);
  const dominantA = metricA >= metricB;
  const winsA = bundle.deltas.filter((d) => d.winner === "A").length;
  const winsB = bundle.deltas.filter((d) => d.winner === "B").length;
  const overallDominantA = winsA >= winsB && dominantA;
  const overallDominantB = winsB > winsA || (!overallDominantA && metricB > metricA);

  const oppDimension: "section" | "gender" | "mawhiba" | null =
    kind === "section" ? "section" : kind === "gender" ? "gender" : kind === "mawhiba" ? "mawhiba" : null;
  const opportunityDeltas =
    oppDimension !== null
      ? buildOpportunityComparisonDeltas(data, bundle.sideA.key, bundle.sideB.key, oppDimension)
      : [];
  const recommendationDeltas =
    oppDimension !== null
      ? buildRecommendationComparisonDeltas(data, bundle.sideA.key, bundle.sideB.key, oppDimension)
      : [];

  return (
    <div className="space-y-4" dir={isAr ? "rtl" : "ltr"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-black text-slate-900">{t("comparison.workspace.title", loc)}</h3>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as ComparisonKind)}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800"
          aria-label={isAr ? "نوع المقارنة" : "Comparison type"}
        >
          {COMPARISON_KIND_OPTIONS.map((o) => (
            <option key={o.kind} value={o.kind}>
              {isAr ? o.labelAr : o.labelEn}
            </option>
          ))}
        </select>
      </div>

      {bundle.narratives[0] ? (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 px-3 py-2">
          <p className="text-[10px] font-bold text-indigo-900">{t("comparison.narrative.executive", loc)}</p>
          <p className="mt-1 text-xs text-slate-800">
            {isAr ? bundle.narratives[0]!.bodyAr : bundle.narratives[0]!.bodyEn}
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <SidePanel
          label={isAr ? bundle.sideA.labelAr : bundle.sideA.labelEn}
          metric={metricA}
          participations={bundle.sideA.participations}
          students={bundle.sideA.students}
          medals={bundle.sideA.medals}
          conversionPct={bundle.sideA.conversionPct}
          isAr={isAr}
          loc={loc}
          dominant={overallDominantA}
          onDrill={drillForKind(bundle.sideA.key, bundle.sideA.labelAr, bundle.sideA.labelEn)}
          drillKey={bundle.sideA.key}
        />
        <SidePanel
          label={isAr ? bundle.sideB.labelAr : bundle.sideB.labelEn}
          metric={metricB}
          participations={bundle.sideB.participations}
          students={bundle.sideB.students}
          medals={bundle.sideB.medals}
          conversionPct={bundle.sideB.conversionPct}
          isAr={isAr}
          loc={loc}
          dominant={overallDominantB}
          onDrill={drillForKind(bundle.sideB.key, bundle.sideB.labelAr, bundle.sideB.labelEn)}
          drillKey={bundle.sideB.key}
        />
      </div>

      <div className="rounded-xl border border-violet-100 bg-violet-50/30 p-3">
        <p className="text-[10px] font-bold text-violet-900">{t("comparison.summary", loc)}</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {bundle.deltas.map((d) => (
            <div
              key={d.key}
              className="flex items-center justify-between rounded-lg border border-white/80 bg-white px-2.5 py-2"
            >
              <span className="text-[10px] font-semibold text-slate-700">
                {isAr ? d.labelAr : d.labelEn}
              </span>
              <span className="text-[9px] text-slate-500 tabular-nums">
                {formatSignedDelta(d.delta, loc)}
              </span>
              <DeltaBadge delta={formatDeltaIndicator(d.delta, loc)} isAr={isAr} />
            </div>
          ))}
        </div>
      </div>

      {opportunityDeltas.length > 0 ? (
        <div className="rounded-xl border border-teal-100 bg-teal-50/30 p-3">
          <p className="text-[10px] font-bold text-teal-900">
            {isAr ? "فجوات الفرص (مقارنة)" : "Opportunity gaps (comparison)"}
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {opportunityDeltas.map((d) => (
              <div
                key={d.key}
                className="flex items-center justify-between rounded-lg border border-white/80 bg-white px-2.5 py-2"
              >
                <span className="text-[10px] font-semibold text-slate-700">
                  {isAr ? d.labelAr : d.labelEn}
                </span>
                <DeltaBadge
                  delta={formatDeltaIndicator(d.delta, loc)}
                  isAr={isAr}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {recommendationDeltas.length > 0 ? (
        <div className="rounded-xl border border-teal-100 bg-teal-50/30 p-3">
          <p className="text-[10px] font-bold text-teal-900">
            {isAr ? "توصيات المقارنة" : "Recommendation comparison"}
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {recommendationDeltas.map((d) => (
              <div
                key={d.key}
                className="flex items-center justify-between rounded-lg border border-white/80 bg-white px-2.5 py-2"
              >
                <span className="text-[10px] font-semibold text-slate-700">
                  {isAr ? d.labelAr : d.labelEn}
                </span>
                <span className="text-[9px] text-slate-500 tabular-nums">
                {formatSignedDelta(d.delta, loc)}
              </span>
              <DeltaBadge delta={formatDeltaIndicator(d.delta, loc)} isAr={isAr} />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {bundle.narratives.length > 0 ? (
        <ul className="grid gap-2 sm:grid-cols-2">
          {bundle.narratives.map((n) => (
            <li
              key={n.id}
              className="rounded-lg border border-indigo-100 bg-indigo-50/40 px-3 py-2 text-xs text-slate-800"
            >
              {isAr ? n.bodyAr : n.bodyEn}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};

export default AnalyticsComparisonWorkspace;
