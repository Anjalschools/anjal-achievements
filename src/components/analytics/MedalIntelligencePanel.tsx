"use client";

import { useMemo } from "react";
import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";
import { buildParticipationCountingSnapshot } from "@/lib/analytics/analytics-counting-contract";
import { buildMedalSectionScopeTitle, buildAnalyticsFilterChips } from "@/lib/analytics/analytics-filter-chips";
import type { ExecutiveFilterSnapshot } from "@/lib/competition-intelligence-persistence";
import {
  formatMedalCount,
  formatNonMedalParticipations,
  formatParticipationCount,
} from "@/lib/analytics/analytics-semantics";
import DrillableMiniHBar from "@/components/analytics/DrillableMiniHBar";
import type { DrillChartSource } from "@/lib/analytics/analytics-drilldown-router";

export type MedalIntelligencePanelProps = {
  isAr: boolean;
  data: ParticipationAnalyticsPayload;
  f: ExecutiveFilterSnapshot;
  onDrill: (source: DrillChartSource, payload: { key?: string; metricKey?: string }) => void;
  drillHint: string;
};

const MedalIntelligencePanel = ({ isAr, data, f, onDrill, drillHint }: MedalIntelligencePanelProps) => {
  const counts = useMemo(() => buildParticipationCountingSnapshot(data), [data]);
  const title = useMemo(
    () => buildMedalSectionScopeTitle(buildAnalyticsFilterChips(f, isAr), isAr),
    [f, isAr]
  );

  const maxOutcome = Math.max(
    1,
    counts.goldCount,
    counts.silverCount,
    counts.bronzeCount,
    counts.participationOnlyCount
  );

  return (
    <section
      className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50/40 to-white p-4 shadow-sm"
      dir={isAr ? "rtl" : "ltr"}
      aria-labelledby="medal-intel-title"
    >
      <h3 id="medal-intel-title" className="text-sm font-black text-slate-900">
        {title}
      </h3>
      <p className="mt-1 text-xs text-slate-600">
        {isAr ? "معدل التحويل إلى ميداليات" : "Medal conversion rate"}:{" "}
        <span className="font-bold tabular-nums text-amber-900">{counts.medalConversionRatePct}%</span>
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[10px] font-bold uppercase text-slate-500">
            {isAr ? "إجمالي المشاركات" : "Total participations"}
          </p>
          <p className="mt-1 text-lg font-black tabular-nums text-slate-900">
            {formatParticipationCount(counts.participationCount, isAr ? "ar" : "en")}
          </p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
          <p className="text-[10px] font-bold uppercase text-amber-900">
            {isAr ? "مشاركات حاصلة على ميداليات" : "Medal-winning participations"}
          </p>
          <p className="mt-1 text-lg font-black tabular-nums text-amber-950">
            {formatMedalCount(counts.medalWinningParticipations, isAr ? "ar" : "en")}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-[10px] font-bold uppercase text-slate-600">
            {isAr ? "مشاركات بدون ميداليات" : "Without medals"}
          </p>
          <p className="mt-1 text-lg font-black tabular-nums text-slate-800">
            {formatNonMedalParticipations(counts.nonMedalParticipations, isAr ? "ar" : "en")}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <DrillableMiniHBar
          label={isAr ? "🥇 ذهبية" : "🥇 Gold"}
          value={counts.goldCount}
          max={maxOutcome}
          isAr={isAr}
          barClassName="h-full rounded-full bg-amber-500"
          drillLabel={drillHint}
          onDrill={() => onDrill("outcome_donut", { key: "gold" })}
        />
        <DrillableMiniHBar
          label={isAr ? "🥈 فضية" : "🥈 Silver"}
          value={counts.silverCount}
          max={maxOutcome}
          isAr={isAr}
          barClassName="h-full rounded-full bg-slate-400"
          drillLabel={drillHint}
          onDrill={() => onDrill("outcome_donut", { key: "silver" })}
        />
        <DrillableMiniHBar
          label={isAr ? "🥉 برونزية" : "🥉 Bronze"}
          value={counts.bronzeCount}
          max={maxOutcome}
          isAr={isAr}
          barClassName="h-full rounded-full bg-orange-700"
          drillLabel={drillHint}
          onDrill={() => onDrill("outcome_donut", { key: "bronze" })}
        />
      </div>
    </section>
  );
};

export default MedalIntelligencePanel;
