"use client";

import { memo, useMemo } from "react";
import type { StudentIntelligencePayload } from "@/lib/student-intelligence-analytics";
import {
  buildCompetitionJourney,
  detectEliteClusters,
  pickHeroStudent,
} from "@/lib/analytics/student-excellence-derivations";
import { computeExecutiveChartBudget } from "@/lib/analytics/executive-performance-budget";
import StudentExcellenceHeroCard from "@/components/analytics/excellence/StudentExcellenceHeroCard";
import StudentExcellenceRadar from "@/components/analytics/excellence/StudentExcellenceRadar";
import StudentAchievementHeatmap from "@/components/analytics/excellence/StudentAchievementHeatmap";
import StudentGrowthTimeline from "@/components/analytics/excellence/StudentGrowthTimeline";
import StudentEliteClusterMap from "@/components/analytics/excellence/StudentEliteClusterMap";
import StudentAwardDistributionChart from "@/components/analytics/excellence/StudentAwardDistributionChart";
import StudentCompetitionJourney from "@/components/analytics/excellence/StudentCompetitionJourney";
import StudentExcellenceInsightPanel from "@/components/analytics/excellence/StudentExcellenceInsightPanel";
import StrategicInsightEmptyState from "@/components/analytics/executive/insights/StrategicInsightEmptyState";
import StudentOpportunityPanel from "@/components/analytics/opportunity/StudentOpportunityPanel";

type StudentListKind =
  | "byWeightedScore"
  | "byParticipation"
  | "byMedals"
  | "bySuccessRate"
  | "byActivityDiversity"
  | "byFastestGrowth";

const LISTS: Array<{ key: StudentListKind; titleAr: string; titleEn: string }> = [
  { key: "byWeightedScore", titleAr: "أفضل الأداء (مرجّح)", titleEn: "Top weighted score" },
  { key: "byParticipation", titleAr: "أكثر المشاركة", titleEn: "Most participation" },
  { key: "byMedals", titleAr: "أكثر الميداليات", titleEn: "Most medals" },
  { key: "bySuccessRate", titleAr: "أعلى معدل نجاح", titleEn: "Highest success rate" },
  { key: "byActivityDiversity", titleAr: "أوسع تنوع أنشطة", titleEn: "Broadest activity mix" },
  { key: "byFastestGrowth", titleAr: "أسرع تطور", titleEn: "Fastest growth" },
];

export type StudentExcellenceWorkspaceProps = {
  isAr: boolean;
  data: StudentIntelligencePayload;
  onSelectStudent?: (participantId: string) => void;
};

export const StudentExcellenceWorkspace = memo(
  ({ isAr, data, onSelectStudent }: StudentExcellenceWorkspaceProps) => {
    const hero = useMemo(() => pickHeroStudent(data), [data]);
    const clusters = useMemo(() => detectEliteClusters(data), [data]);
    const pool = data.byWeightedScore;
    const journey = useMemo(
      () => (hero ? buildCompetitionJourney(hero) : []),
      [hero]
    );

    const budget = useMemo(
      () =>
        computeExecutiveChartBudget({
          chartCount: 5,
          yearCount: hero?.yearSpan ?? 3,
          rowCount: pool.length,
        }),
      [hero, pool.length]
    );

    const cards = useMemo(() => {
      return LISTS.map((l) => {
        const list = data[l.key] ?? [];
        return { ...l, list };
      });
    }, [data]);

    const hasData = pool.length > 0;

    return (
      <section className="space-y-4" dir={isAr ? "rtl" : "ltr"} id="exec-excellence">
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-teal-50/50 to-white p-4 shadow-sm ring-1 ring-teal-100/60">
          <h2 className="text-sm font-black text-teal-950">
            {isAr ? "ذكاء تميّز الطلاب" : "Student excellence intelligence"}
          </h2>
          <p className="mt-1 text-xs text-teal-900/80" dir="auto">
            {isAr
              ? "تجربة ذكاء تعليمي تنفيذية — رادار، مسار مسابقات، نخبة، ونمو زمني."
              : "Executive educational intelligence — radar, journey, elite clusters, and growth timeline."}
          </p>
          {budget.exceedsBudget ? (
            <p className="mt-2 text-[10px] font-semibold text-violet-800">
              {isAr ? budget.reasonAr : budget.reasonEn}
            </p>
          ) : null}
        </div>

        {!hasData ? (
          <StrategicInsightEmptyState isAr={isAr} />
        ) : (
          <>
            {hero ? (
              <StudentExcellenceHeroCard isAr={isAr} row={hero} onSelect={onSelectStudent} />
            ) : null}

            {hero ? <StudentOpportunityPanel isAr={isAr} row={hero} /> : null}

            <StudentExcellenceInsightPanel
              isAr={isAr}
              insightAr="أعلى الطلاب يجمعون بين حجم المشاركة ومعدل الميداليات ضمن الفلاتر الحالية."
              insightEn="Top students combine participation volume and medal rates under current filters."
              confidenceLabel={isAr ? "ثقة: عالية" : "Confidence: high"}
            />

            <div className="grid gap-4 lg:grid-cols-2">
              {hero && !budget.deferAdvancedCharts ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="text-xs font-black text-slate-800">
                    {isAr ? "رادار الذكاء" : "Intelligence radar"}
                  </h3>
                  <StudentExcellenceRadar isAr={isAr} row={hero} />
                </div>
              ) : null}
              {hero ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="text-xs font-black text-slate-800">
                    {isAr ? "خط زمني للنمو" : "Growth timeline"}
                  </h3>
                  <StudentGrowthTimeline isAr={isAr} row={hero} />
                </div>
              ) : null}
            </div>

            {journey.length > 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="mb-2 text-xs font-black text-slate-800">
                  {isAr ? "مسار المسابقة" : "Competition journey"}
                </h3>
                <StudentCompetitionJourney isAr={isAr} stages={journey} />
              </div>
            ) : null}

            {!budget.hideClusterMap && clusters.length > 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="mb-2 text-xs font-black text-slate-800">
                  {isAr ? "خرائط النخبة" : "Elite clusters"}
                </h3>
                <StudentEliteClusterMap isAr={isAr} clusters={clusters} />
              </div>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-2">
              {!budget.hideHeatmap ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="mb-2 text-xs font-black text-slate-800">
                    {isAr ? "خريطة حرارية للإنجاز" : "Achievement heatmap"}
                  </h3>
                  <StudentAchievementHeatmap isAr={isAr} rows={pool} />
                </div>
              ) : null}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="mb-2 text-xs font-black text-slate-800">
                  {isAr ? "توزيع الجوائز" : "Award distribution"}
                </h3>
                <StudentAwardDistributionChart isAr={isAr} rows={pool} />
              </div>
            </div>
          </>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((c) => (
            <div key={c.key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">
                {isAr ? c.titleAr : c.titleEn}
              </h3>
              <ul className="mt-3 space-y-2">
                {c.list.length === 0 ? (
                  <li className="text-xs text-slate-500">{isAr ? "لا بيانات." : "No rows."}</li>
                ) : (
                  c.list.slice(0, 10).map((row) => (
                    <li key={`${c.key}-${row.participantId}`} className="list-none">
                      <button
                        type="button"
                        className="flex w-full items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-2 text-start transition hover:border-indigo-200 hover:bg-indigo-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                        onClick={() => onSelectStudent?.(row.participantId)}
                        aria-label={
                          isAr ? `عرض ملف ${row.nameAr}` : `Open profile for ${row.nameEn}`
                        }
                      >
                        {row.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={row.avatarUrl}
                            alt=""
                            className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
                          />
                        ) : (
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-600">
                            {(isAr ? row.nameAr : row.nameEn).slice(0, 1)}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-slate-900" dir="auto">
                            {isAr ? row.nameAr : row.nameEn}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-600" dir="auto">
                            {row.recordCount} · {row.medalCount}
                          </p>
                        </div>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          ))}
        </div>
      </section>
    );
  }
);

StudentExcellenceWorkspace.displayName = "StudentExcellenceWorkspace";
