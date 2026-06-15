"use client";

import { useCallback, useEffect, useState } from "react";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionCard from "@/components/layout/SectionCard";
import { getLocale } from "@/lib/i18n";
import { ClipboardList, Download, Loader2, Shield, Target } from "lucide-react";
import type { SchoolImprovementPayload } from "@/lib/school-improvement/school-improvement-types";

const priorityColor = (p: string) => {
  if (p === "high") return "text-red-700 bg-red-50";
  if (p === "medium") return "text-amber-700 bg-amber-50";
  return "text-slate-600 bg-slate-50";
};

const SchoolImprovementIntelligencePage = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SchoolImprovementPayload | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/school-improvement-intelligence", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      setData(json.improvement || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleExport = (report: string) => {
    const params = new URLSearchParams({
      format: "html",
      report,
      lang: isAr ? "ar" : "en",
    });
    window.open(`/api/admin/school-improvement-intelligence/export?${params.toString()}`, "_blank");
  };

  return (
    <PageContainer>
      <PageHeader
        title={isAr ? "ذكاء التحسين المدرسي والإجراءات" : "School improvement intelligence & actions"}
        subtitle={
          isAr
            ? "من ماذا حدث؟ إلى ماذا نفعل بعد؟ — توصيات قابلة للتفسير بلا تنفيذ تلقائي"
            : "From what happened to what next — explainable recommendations, no auto-execution"
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
          <Shield className="h-3 w-3" aria-hidden />
          {isAr ? "قراءة فقط — بلا تنفيذ تلقائي" : "Read-only — no auto-execution"}
        </span>
        {(["board", "leadership", "school_planning"] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => handleExport(kind)}
            className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold"
          >
            <Download className="h-3 w-3" aria-hidden />
            {kind === "board"
              ? isAr
                ? "تقرير المجلس"
                : "Board report"
              : kind === "leadership"
                ? isAr
                  ? "القيادة المدرسية"
                  : "Leadership report"
                : isAr
                  ? "التخطيط المدرسي"
                  : "School planning"}
          </button>
        ))}
      </div>

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-text-light">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          <span>{isAr ? "جاري بناء خطة التحسين…" : "Building improvement plan…"}</span>
        </div>
      ) : !data ? (
        <p className="py-12 text-center text-text-light">{isAr ? "لا بيانات." : "No data."}</p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: isAr ? "إجراءات مقترحة" : "Proposed actions", value: data.summary.totalActions },
              { label: isAr ? "أولوية عالية" : "High priority", value: data.summary.highPriority },
              { label: isAr ? "خطط تحسين" : "Improvement plans", value: data.improvementPlans.length },
              { label: isAr ? "تميز المدرسة" : "School excellence", value: data.summary.schoolExcellenceIndex },
            ].map((card) => (
              <div key={card.label} className="rounded-2xl border border-border/70 p-4">
                <p className="text-xs text-text-light">{card.label}</p>
                <p className="text-2xl font-black">{card.value}</p>
              </div>
            ))}
          </div>

          {data.partnershipIndicators ? (
            <SectionCard>
              <h2 className="mb-3 text-base font-bold">
                {isAr ? "مؤشرات الشراكات والتدريب" : "Partnership & training indicators"}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: isAr ? "الجاهزية المهنية" : "Career readiness", value: `${data.partnershipIndicators.careerReadiness}%` },
                  { label: isAr ? "الشراكات الخارجية" : "External partnerships", value: `${data.partnershipIndicators.externalPartnerships}%` },
                  { label: isAr ? "التعرض المهني" : "Professional exposure", value: `${data.partnershipIndicators.professionalExposure}%` },
                  { label: isAr ? "نجاح التوظيف" : "Placement success", value: `${data.partnershipIndicators.studentPlacementSuccess}%` },
                ].map((card) => (
                  <div key={card.label} className="rounded-xl border border-border/70 px-4 py-3">
                    <p className="text-xs text-text-light">{card.label}</p>
                    <p className="text-xl font-black">{card.value}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          ) : null}

          <SectionCard>
            <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
              <Target className="h-4 w-4" aria-hidden />
              {isAr ? "محرك الإجراءات" : "Action engine"}
            </h2>
            <ul className="divide-y divide-border/60 text-sm">
              {data.actionEngine.slice(0, 12).map((action) => (
                <li key={action.id} className="py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${priorityColor(action.priority)}`}>
                      {action.priority}
                    </span>
                    <span className="text-xs text-text-light">
                      {isAr ? action.ownerLabelAr : action.ownerLabelEn} · {isAr ? action.timeline : action.timelineEn}
                    </span>
                  </div>
                  <p className="mt-1 font-semibold">{isAr ? action.recommendationAr : action.recommendationEn}</p>
                  <p className="text-xs text-text-light">
                    {isAr ? action.expectedImpactAr : action.expectedImpactEn}
                  </p>
                </li>
              ))}
            </ul>
          </SectionCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard>
              <h2 className="mb-3 text-base font-bold">{isAr ? "خطط التحسين" : "Improvement plans"}</h2>
              <ul className="divide-y divide-border/60 text-sm">
                {data.improvementPlans.map((plan) => (
                  <li key={plan.id} className="py-2">
                    <p className="font-semibold">{isAr ? plan.titleAr : plan.titleEn}</p>
                    <p className="text-text-light">{isAr ? plan.objectiveAr : plan.objectiveEn}</p>
                    <p className="text-xs text-primary">{plan.actions.length} {isAr ? "إجراء" : "actions"}</p>
                  </li>
                ))}
              </ul>
            </SectionCard>

            <SectionCard>
              <h2 className="mb-3 text-base font-bold">{isAr ? "توصيات الفرص" : "Opportunity recommendations"}</h2>
              <ul className="divide-y divide-border/60 text-sm">
                {data.opportunityRecommendations.slice(0, 10).map((rec) => (
                  <li key={rec.id} className="py-2">
                    <p className="font-semibold">{isAr ? rec.titleAr : rec.titleEn}</p>
                    <p className="text-text-light">{isAr ? rec.reasonAr : rec.reasonEn}</p>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {data.studentActionLists.map((list) => (
              <SectionCard key={list.category}>
                <h2 className="mb-3 text-base font-bold">{isAr ? list.titleAr : list.titleEn}</h2>
                <ul className="max-h-48 divide-y divide-border/60 overflow-y-auto text-xs">
                  {list.students.slice(0, 8).map((s) => (
                    <li key={s.studentId} className="py-1.5">
                      <p className="font-semibold">{s.fullName}</p>
                      <p className="text-text-light">{isAr ? s.suggestedActionAr : s.suggestedActionEn}</p>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard>
              <h2 className="mb-3 text-base font-bold">{isAr ? "توسيع المؤسسات" : "Institution expansion"}</h2>
              <ul className="divide-y divide-border/60 text-sm">
                {data.institutionExpansion.map((item) => (
                  <li key={item.id} className="py-2">
                    <p className="font-semibold">{isAr ? item.titleAr : item.titleEn}</p>
                    <p className="text-text-light">{isAr ? item.reasonAr : item.reasonEn}</p>
                  </li>
                ))}
              </ul>
            </SectionCard>

            <SectionCard>
              <h2 className="mb-3 text-base font-bold">{isAr ? "محاكاة التحسين" : "Predictive improvement"}</h2>
              <ul className="divide-y divide-border/60 text-sm">
                {data.predictiveScenarios.map((s) => (
                  <li key={s.id} className="py-2">
                    <p className="font-semibold">{isAr ? s.scenarioAr : s.scenarioEn}</p>
                    <p className="text-text-light">
                      {s.currentValue} → {s.projectedValue} ({s.confidence})
                    </p>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </div>

          <SectionCard>
            <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
              <ClipboardList className="h-4 w-4" aria-hidden />
              {isAr ? "خارطة الطريق الاستراتيجية" : "Strategic roadmap"}
            </h2>
            <div className="grid gap-3 md:grid-cols-3">
              {(["annual", "quarterly", "monthly"] as const).map((horizon) => (
                <div key={horizon} className="rounded-xl border border-border/60 p-3">
                  <p className="mb-2 text-xs font-bold uppercase text-primary">
                    {horizon === "annual"
                      ? isAr
                        ? "سنوي"
                        : "Annual"
                      : horizon === "quarterly"
                        ? isAr
                          ? "فصلي"
                          : "Quarterly"
                        : isAr
                          ? "شهري"
                          : "Monthly"}
                  </p>
                  <ul className="space-y-1 text-xs">
                    {data.strategicRoadmap
                      .filter((r) => r.horizon === horizon)
                      .slice(0, 2)
                      .map((r) => (
                        <li key={r.id}>
                          <p className="font-semibold">{isAr ? r.periodLabelAr : r.periodLabelEn}</p>
                          <p className="text-text-light">{r.actions.length} {isAr ? "إجراء" : "actions"}</p>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard>
            <h2 className="mb-3 text-base font-bold">{isAr ? "تتبع التحسين" : "Improvement tracking"}</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-border/70">
                    <th className="px-2 py-2 text-start">{isAr ? "الإجراء" : "Action"}</th>
                    <th className="px-2 py-2">{isAr ? "الحالة" : "Status"}</th>
                    <th className="px-2 py-2">{isAr ? "الأولوية" : "Priority"}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.improvementTracking.slice(0, 15).map((row) => (
                    <tr key={row.actionId} className="border-b border-border/40">
                      <td className="px-2 py-2">{isAr ? row.titleAr : row.titleEn}</td>
                      <td className="px-2 py-2 text-center">{row.status}</td>
                      <td className="px-2 py-2 text-center">{row.priority}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      )}
    </PageContainer>
  );
};

export default SchoolImprovementIntelligencePage;
