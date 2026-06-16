"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionCard from "@/components/layout/SectionCard";
import { getLocale } from "@/lib/i18n";
import { Award, Building2, Clock, Download, FileText, Loader2, TrendingUp } from "lucide-react";

type PortfolioPayload = {
  studentName: string;
  summary: {
    trainingCount: number;
    totalHours: number;
    avgEmployabilityScore: number;
    avgReadinessScore: number;
    employmentRecommendations: number;
    bestOutcomeLevel: string | null;
  };
  timeline: Array<{
    applicationId: string;
    institutionName: string;
    opportunityTitle: string;
    academicYearLabel: string;
    trainingHours: number;
    employabilityScore: number;
    outcomeLevel: string;
    approvedAt: string;
  }>;
  institutions: Array<{
    institutionName: string;
    trainingCount: number;
    totalHours: number;
    avgEmployability: number;
  }>;
  employabilityTrend: Array<{ label: string; score: number }>;
  evaluationResults: Array<{
    applicationId: string;
    studentSatisfactionScore: number;
    institutionEvaluationScore: number;
    outcomeLevel: string;
    recommendedForFutureTraining: boolean;
    recommendedForEmployment: boolean;
  }>;
  certificates: Array<{ id: string; title: string; organizationName: string; hours: number }>;
  recognitions: Array<{ type: string; labelAr: string; labelEn: string }>;
  reports: Array<{ applicationId: string; label: string; path: string }>;
};

const outcomeLabel = (level: string, isAr: boolean): string => {
  const map: Record<string, { ar: string; en: string }> = {
    excellent: { ar: "ممتاز", en: "Excellent" },
    very_good: { ar: "جيد جداً", en: "Very good" },
    good: { ar: "جيد", en: "Good" },
    satisfactory: { ar: "مقبول", en: "Satisfactory" },
    needs_improvement: { ar: "يحتاج تطوير", en: "Needs improvement" },
  };
  const row = map[level];
  return row ? (isAr ? row.ar : row.en) : level;
};

const TrainingPortfolioPage = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PortfolioPayload | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/user/training-portfolio?lang=${isAr ? "ar" : "en"}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      setData(json.item as PortfolioPayload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [isAr]);

  useEffect(() => {
    load();
  }, [load]);

  const handleExport = () => {
    window.open(`/api/user/training-portfolio/export?lang=${isAr ? "ar" : "en"}`, "_blank");
  };

  const summaryCards = data
    ? [
        { label: isAr ? "عدد التدريبات" : "Trainings", value: data.summary.trainingCount, icon: Building2 },
        { label: isAr ? "إجمالي الساعات" : "Total hours", value: data.summary.totalHours, icon: Clock },
        {
          label: isAr ? "متوسط الجاهزية للتوظيف" : "Avg employability",
          value: data.summary.avgEmployabilityScore,
          icon: TrendingUp,
        },
        {
          label: isAr ? "توصيات التوظيف" : "Employment recs",
          value: data.summary.employmentRecommendations,
          icon: Award,
        },
      ]
    : [];

  return (
    <PageContainer>
      <PageHeader
        title={isAr ? "ملف التدريب المهني" : "Training portfolio"}
        subtitle={
          isAr
            ? "عرض للقراءة فقط — يجمع نتائج تدريباتك المعتمدة وتقييماتك."
            : "Read-only view of your approved training outcomes and evaluations."
        }
        actions={
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-2 text-sm font-bold text-primary"
            aria-label={isAr ? "تصدير PDF" : "Export PDF"}
          >
            <Download className="h-4 w-4" aria-hidden />
            {isAr ? "تصدير PDF" : "Export PDF"}
          </button>
        }
      />

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-text-light">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          <span>{isAr ? "جاري التحميل…" : "Loading…"}</span>
        </div>
      ) : !data ? (
        <p className="py-12 text-center text-text-light">{isAr ? "لا توجد بيانات." : "No data."}</p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => (
              <div key={card.label} className="rounded-2xl border border-border/70 bg-white p-4 shadow-sm">
                <p className="flex items-center gap-1 text-xs font-semibold text-text-light">
                  <card.icon className="h-3.5 w-3.5" aria-hidden />
                  {card.label}
                </p>
                <p className="mt-1 text-2xl font-black text-primary">{card.value}</p>
              </div>
            ))}
          </div>

          {data.recognitions.length > 0 ? (
            <SectionCard>
              <h2 className="mb-3 text-base font-bold">{isAr ? "التقديرات" : "Recognitions"}</h2>
              <div className="flex flex-wrap gap-2">
                {data.recognitions.map((r) => (
                  <span key={r.type} className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                    {isAr ? r.labelAr : r.labelEn}
                  </span>
                ))}
              </div>
            </SectionCard>
          ) : null}

          <SectionCard>
            <h2 className="mb-3 text-base font-bold">{isAr ? "الجدول الزمني" : "Training timeline"}</h2>
            {data.timeline.length === 0 ? (
              <p className="text-sm text-text-light">{isAr ? "لا تدريبات معتمدة بعد." : "No approved trainings yet."}</p>
            ) : (
              <div className="space-y-3">
                {data.timeline.map((row) => (
                  <div key={row.applicationId} className="rounded-xl border border-border/60 p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong>{row.institutionName}</strong>
                      <span className="text-xs text-text-light">{row.academicYearLabel}</span>
                    </div>
                    <p className="text-text-light">{row.opportunityTitle}</p>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs">
                      <span>{row.trainingHours}h</span>
                      <span>{isAr ? "الجاهزية:" : "Employability:"} {row.employabilityScore}</span>
                      <span>{outcomeLabel(row.outcomeLevel, isAr)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard>
              <h2 className="mb-3 text-base font-bold">{isAr ? "المؤسسات" : "Institutions"}</h2>
              {data.institutions.map((inst) => (
                <div key={inst.institutionName} className="mb-2 rounded-lg bg-muted/40 p-3 text-sm">
                  <strong>{inst.institutionName}</strong>
                  <p className="text-xs text-text-light">
                    {inst.trainingCount} {isAr ? "تدريب" : "training(s)"} · {inst.totalHours}h · {inst.avgEmployability}
                  </p>
                </div>
              ))}
            </SectionCard>

            <SectionCard>
              <h2 className="mb-3 text-base font-bold">{isAr ? "اتجاه الجاهزية للتوظيف" : "Employability trend"}</h2>
              {data.employabilityTrend.map((point, idx) => (
                <div key={`${point.label}-${idx}`} className="mb-2 flex items-center justify-between text-sm">
                  <span>{point.label}</span>
                  <span className="font-bold text-primary">{point.score}</span>
                </div>
              ))}
            </SectionCard>
          </div>

          <SectionCard>
            <h2 className="mb-3 text-base font-bold">{isAr ? "نتائج التقييم" : "Evaluation results"}</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-text-light">
                    <th className="px-2 py-2 text-start">{isAr ? "الرضا" : "Satisfaction"}</th>
                    <th className="px-2 py-2 text-start">{isAr ? "تقييم المؤسسة" : "Institution eval"}</th>
                    <th className="px-2 py-2 text-start">{isAr ? "المستوى" : "Outcome"}</th>
                    <th className="px-2 py-2 text-start">{isAr ? "توصيات" : "Recs"}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.evaluationResults.map((row) => (
                    <tr key={row.applicationId} className="border-b border-border/40">
                      <td className="px-2 py-2">{row.studentSatisfactionScore}/10</td>
                      <td className="px-2 py-2">{row.institutionEvaluationScore}</td>
                      <td className="px-2 py-2">{outcomeLabel(row.outcomeLevel, isAr)}</td>
                      <td className="px-2 py-2 text-xs">
                        {row.recommendedForFutureTraining ? (isAr ? "تدريب" : "Training") : "—"}
                        {row.recommendedForEmployment ? ` · ${isAr ? "توظيف" : "Employment"}` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard>
              <h2 className="mb-3 text-base font-bold">{isAr ? "الشهادات" : "Certificates"}</h2>
              {data.certificates.length === 0 ? (
                <p className="text-sm text-text-light">{isAr ? "لا شهادات." : "No certificates."}</p>
              ) : (
                data.certificates.map((c) => (
                  <div key={c.id} className="mb-2 text-sm">
                    <strong>{c.title}</strong>
                    <p className="text-xs text-text-light">{c.organizationName} · {c.hours}h</p>
                  </div>
                ))
              )}
            </SectionCard>

            <SectionCard>
              <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
                <FileText className="h-4 w-4" aria-hidden />
                {isAr ? "التقارير" : "Reports"}
              </h2>
              {data.reports.map((r) => (
                <Link
                  key={r.applicationId}
                  href={r.path}
                  className="mb-2 block text-sm font-semibold text-primary hover:underline"
                >
                  {r.label}
                </Link>
              ))}
            </SectionCard>
          </div>
        </div>
      )}
    </PageContainer>
  );
};

export default TrainingPortfolioPage;
