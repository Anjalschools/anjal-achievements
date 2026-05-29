"use client";

import { memo, useMemo } from "react";
import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";
import type { AnalyticsInsightsBundle } from "@/lib/analytics/analytics-insights-engine";
import type { ExecutiveSemanticInsight } from "@/lib/analytics/intelligence/analytics-narrative-schema";
import type { ExecutiveNarrative } from "@/lib/analytics/analytics-narrative-engine";
import type { StudentIntelRow } from "@/lib/student-intelligence-analytics";
import type { AiDecisionEngineResult } from "@/lib/analytics/ai/ai-decision-schema";
import { buildAiExecutiveDecisions } from "@/lib/analytics/ai/ai-decision-engine";
import { answerExecutiveQuestions } from "@/lib/analytics/ai/executive-board-summary";
import ExecutiveDecisionPriorityQueue from "@/components/analytics/decision/ExecutiveDecisionPriorityQueue";
import ExecutiveDecisionGrid from "@/components/analytics/decision/ExecutiveDecisionGrid";
import ExecutiveDecisionTimeline from "@/components/analytics/decision/ExecutiveDecisionTimeline";
import ExecutiveDecisionExecutionMap from "@/components/analytics/decision/ExecutiveDecisionExecutionMap";
import ExecutiveDecisionEmptyState from "@/components/analytics/decision/ExecutiveDecisionEmptyState";

export type ExecutiveDecisionWorkspaceProps = {
  isAr: boolean;
  filterFingerprint: string;
  data: ParticipationAnalyticsPayload | null;
  insights: AnalyticsInsightsBundle;
  narratives: ExecutiveNarrative[];
  strategicInsights: ExecutiveSemanticInsight[];
  precomputed?: AiDecisionEngineResult | null;
  studentIntelRows?: StudentIntelRow[];
};

export const ExecutiveDecisionWorkspace = memo(
  ({
    isAr,
    filterFingerprint,
    data,
    insights,
    narratives,
    strategicInsights,
    precomputed,
    studentIntelRows,
  }: ExecutiveDecisionWorkspaceProps) => {
    const engineResult = useMemo(() => {
      if (precomputed?.bundle?.decisions?.length) return precomputed;
      if (!data?.ok) return null;
      return buildAiExecutiveDecisions({
        filterFingerprint,
        filterScope: filterFingerprint,
        general: data,
        insights,
        narratives,
        strategicInsights,
        kpiStrip: undefined,
        studentIntelRows,
        useCache: true,
      });
    }, [precomputed, filterFingerprint, data, insights, narratives, strategicInsights, studentIntelRows]);

    const qa = useMemo(
      () => (engineResult ? answerExecutiveQuestions(engineResult.bundle, isAr) : []),
      [engineResult, isAr]
    );

    if (!engineResult?.bundle.hasData) {
      return <ExecutiveDecisionEmptyState isAr={isAr} />;
    }

    const { bundle, actionPlan, boardSummary } = engineResult;

    return (
      <section className="space-y-6 print:break-inside-avoid" dir={isAr ? "rtl" : "ltr"} id="exec-decisions">
        <div className="sticky top-16 z-20 rounded-2xl border border-indigo-200 bg-indigo-50/95 p-4 shadow-sm backdrop-blur print:static">
          <h2 className="text-sm font-black text-indigo-950">
            {isAr ? "ذكاء القرار التنفيذي" : "Executive decision intelligence"}
          </h2>
          <p className="mt-1 text-xs text-indigo-900/90">{isAr ? boardSummary.headlineAr : boardSummary.headlineEn}</p>
        </div>

        <ExecutiveDecisionPriorityQueue
          isAr={isAr}
          title={isAr ? "L1 — أولويات استراتيجية" : "L1 — Strategic priorities"}
          decisions={bundle.topPriorities}
        />

        <ExecutiveDecisionPriorityQueue
          isAr={isAr}
          title={isAr ? "L2 — مخاطر مؤسسية" : "L2 — Institutional risks"}
          decisions={bundle.criticalRisks}
        />

        <ExecutiveDecisionPriorityQueue
          isAr={isAr}
          title={isAr ? "L3 — فرص عالية الأثر" : "L3 — High-impact opportunities"}
          decisions={bundle.highImpactOpportunities}
        />

        <div>
          <h3 className="mb-2 text-xs font-black text-slate-800">
            {isAr ? "L4 — إجراءات تنفيذية" : "L4 — Executive actions"}
          </h3>
          <ExecutiveDecisionGrid isAr={isAr} decisions={bundle.recommendedActions} />
        </div>

        <div>
          <h3 className="mb-2 text-xs font-black text-slate-800">
            {isAr ? "L5 — محاكاة الأثر" : "L5 — Impact simulation"}
          </h3>
          <ExecutiveDecisionGrid isAr={isAr} decisions={bundle.decisions.slice(0, 6)} />
        </div>

        <div>
          <h3 className="mb-2 text-xs font-black text-slate-800">
            {isAr ? "L6 — خارطة التنفيذ" : "L6 — Execution roadmap"}
          </h3>
          <ExecutiveDecisionTimeline isAr={isAr} decisions={bundle.decisions} />
          <div className="mt-3">
            <ExecutiveDecisionExecutionMap isAr={isAr} plan={actionPlan} />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-xs font-black text-slate-800">
            {isAr ? "أسئلة الإدارة التنفيذية" : "Executive Q&A"}
          </h3>
          <dl className="mt-3 space-y-2">
            {qa.map((row) => (
              <div key={row.q} className="border-b border-slate-100 pb-2 last:border-0">
                <dt className="text-[10px] font-black text-slate-500">{row.q}</dt>
                <dd className="text-xs text-slate-800">{row.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    );
  }
);

ExecutiveDecisionWorkspace.displayName = "ExecutiveDecisionWorkspace";
