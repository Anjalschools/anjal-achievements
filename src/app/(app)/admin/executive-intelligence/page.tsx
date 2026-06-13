"use client";

import { useCallback, useEffect, useState } from "react";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionCard from "@/components/layout/SectionCard";
import { getLocale } from "@/lib/i18n";
import { Download, Loader2, Shield } from "lucide-react";

type Dashboard = {
  generatedAt: string;
  talentPipeline: {
    byUniversityReadiness: Array<{ studentId: string; fullName: string; universityReadiness: number; careerReadiness: number; evidence: string }>;
    byCareerReadiness: Array<{ studentId: string; fullName: string; universityReadiness: number; careerReadiness: number }>;
    byTrainingHours: Array<{ studentId: string; fullName: string; trainingHours: number }>;
    byVolunteerHours: Array<{ studentId: string; fullName: string; volunteerHours: number }>;
    byAnnualGrowth: Array<{ studentId: string; fullName: string; annualGrowth?: number }>;
  };
  risks: Array<{ studentId: string; fullName: string; riskType: string; severity: string; detailAr: string; detailEn: string }>;
  opportunityGaps: Array<{ key: string; labelAr: string; labelEn: string; gapPct: number; dimension: string }>;
  institutionEffectiveness: Array<{ organizationName: string; studentCount: number; totalHours: number; satisfactionPct: number; completionRatePct: number }>;
  competitionRoi: Array<{ labelAr: string; labelEn: string; participations: number; growthRatePct: number; roiScore: number }>;
  executiveInsights: Array<{ title: string; titleEn: string; body: string; severity: string; insightType: string }>;
  strategicRecommendations: Array<{ titleAr: string; titleEn: string; reasonAr: string; reasonEn: string; priority: string; category: string }>;
  predictions: Array<{ labelAr: string; labelEn: string; currentYearValue: number; predictedNextYear: number; method: string }>;
  careerSummary: {
    totalProfiles: number;
    averages: { universityReadiness: number; careerReadiness: number; trainingHours: number; volunteerHours: number };
  };
  governance: { readOnly: boolean; explainable: boolean; dataSources: string[] };
};

const ExecutiveIntelligencePage = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Dashboard | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/executive-intelligence", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      setData(json.dashboard || null);
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
    window.open(`/api/admin/executive-intelligence?${params.toString()}`, "_blank");
  };

  return (
    <PageContainer>
      <PageHeader
        title={isAr ? "الذكاء التنفيذي للقرارات" : "Executive decision intelligence"}
        subtitle={
          isAr
            ? "طبقة قراءة فقط — مؤشرات قابلة للتفسير لدعم قرارات الإدارة"
            : "Read-only, explainable indicators to support leadership decisions"
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
          <Shield className="h-3 w-3" aria-hidden />
          {isAr ? "قراءة فقط — بلا تعديل للبيانات" : "Read-only — no data mutation"}
        </span>
        {(["executive", "board", "school_improvement"] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => handleExport(kind)}
            className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold"
          >
            <Download className="h-3 w-3" aria-hidden />
            {kind === "executive"
              ? isAr
                ? "تقرير تنفيذي"
                : "Executive PDF"
              : kind === "board"
                ? isAr
                  ? "تقرير المجلس"
                  : "Board report"
                : isAr
                  ? "تحسين المدرسة"
                  : "School improvement"}
          </button>
        ))}
      </div>

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-text-light">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          <span>{isAr ? "جاري التحليل…" : "Analyzing…"}</span>
        </div>
      ) : !data ? (
        <p className="py-12 text-center text-text-light">{isAr ? "لا بيانات." : "No data."}</p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: isAr ? "الملفات المهنية" : "Career profiles", value: data.careerSummary.totalProfiles },
              { label: isAr ? "جاهزية جامعية" : "University readiness", value: data.careerSummary.averages.universityReadiness },
              { label: isAr ? "جاهزية مهنية" : "Career readiness", value: data.careerSummary.averages.careerReadiness },
              { label: isAr ? "مخاطر" : "Risks", value: data.risks.length },
            ].map((card) => (
              <div key={card.label} className="rounded-2xl border border-border/70 p-4">
                <p className="text-xs text-text-light">{card.label}</p>
                <p className="text-2xl font-black">{card.value}</p>
              </div>
            ))}
          </div>

          <SectionCard>
            <h2 className="mb-3 text-base font-bold">{isAr ? "رؤى تنفيذية آلية" : "AI executive insights"}</h2>
            <ul className="space-y-2 text-sm">
              {data.executiveInsights.slice(0, 8).map((ins, idx) => (
                <li key={idx} className="rounded-xl bg-muted/50 px-3 py-2">
                  <p className="font-semibold">{isAr ? ins.title : ins.titleEn}</p>
                  <p className="text-text-light">{ins.body}</p>
                  <p className="mt-1 text-xs text-primary">{ins.insightType} · {ins.severity}</p>
                </li>
              ))}
            </ul>
          </SectionCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard>
              <h2 className="mb-3 text-base font-bold">{isAr ? "خط أنابيب المواهب" : "Talent pipeline"}</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/70">
                      <th className="px-2 py-2 text-start">{isAr ? "الطالب" : "Student"}</th>
                      <th className="px-2 py-2">{isAr ? "جامعي" : "Uni"}</th>
                      <th className="px-2 py-2">{isAr ? "مهني" : "Career"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.talentPipeline.byUniversityReadiness.slice(0, 10).map((row) => (
                      <tr key={row.studentId} className="border-b border-border/40">
                        <td className="px-2 py-2">{row.fullName}</td>
                        <td className="px-2 py-2 text-center">{row.universityReadiness}</td>
                        <td className="px-2 py-2 text-center">{row.careerReadiness}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            <SectionCard>
              <h2 className="mb-3 text-base font-bold">{isAr ? "كشف المخاطر" : "Risk detection"}</h2>
              <ul className="divide-y divide-border/60 text-sm">
                {data.risks.slice(0, 8).map((row) => (
                  <li key={`${row.studentId}-${row.riskType}`} className="py-2">
                    <p className="font-semibold">{row.fullName}</p>
                    <p className="text-text-light">{isAr ? row.detailAr : row.detailEn}</p>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard>
              <h2 className="mb-3 text-base font-bold">{isAr ? "فجوات الفرص" : "Opportunity gaps"}</h2>
              <ul className="divide-y divide-border/60 text-sm">
                {data.opportunityGaps.slice(0, 8).map((row) => (
                  <li key={row.key} className="flex justify-between py-2">
                    <span>{isAr ? row.labelAr : row.labelEn}</span>
                    <span className="font-bold text-amber-700">{row.gapPct}%</span>
                  </li>
                ))}
              </ul>
            </SectionCard>

            <SectionCard>
              <h2 className="mb-3 text-base font-bold">{isAr ? "فعالية المؤسسات" : "Institution effectiveness"}</h2>
              <ul className="divide-y divide-border/60 text-sm">
                {data.institutionEffectiveness.slice(0, 8).map((row) => (
                  <li key={row.organizationName} className="py-2">
                    <p className="font-semibold">{row.organizationName}</p>
                    <p className="text-text-light">
                      {row.studentCount} {isAr ? "طالب" : "students"} · {row.satisfactionPct}% {isAr ? "رضا" : "satisfaction"} · {row.completionRatePct}% {isAr ? "إكمال" : "completion"}
                    </p>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </div>

          <SectionCard>
            <h2 className="mb-3 text-base font-bold">{isAr ? "عائد المسابقات" : "Competition ROI"}</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-border/70">
                    <th className="px-2 py-2 text-start">{isAr ? "المسابقة" : "Competition"}</th>
                    <th className="px-2 py-2">{isAr ? "مشاركات" : "Participations"}</th>
                    <th className="px-2 py-2">{isAr ? "نمو" : "Growth"}</th>
                    <th className="px-2 py-2">ROI</th>
                  </tr>
                </thead>
                <tbody>
                  {data.competitionRoi.map((row) => (
                    <tr key={row.labelEn} className="border-b border-border/40">
                      <td className="px-2 py-2">{isAr ? row.labelAr : row.labelEn}</td>
                      <td className="px-2 py-2 text-center">{row.participations}</td>
                      <td className="px-2 py-2 text-center">{row.growthRatePct}%</td>
                      <td className="px-2 py-2 text-center font-bold">{row.roiScore}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard>
              <h2 className="mb-3 text-base font-bold">{isAr ? "توصيات استراتيجية" : "Strategic recommendations"}</h2>
              <ul className="space-y-2 text-sm">
                {data.strategicRecommendations.map((rec, idx) => (
                  <li key={idx} className="rounded-lg border border-border/60 px-3 py-2">
                    <p className="font-semibold">{isAr ? rec.titleAr : rec.titleEn}</p>
                    <p className="text-text-light">{isAr ? rec.reasonAr : rec.reasonEn}</p>
                  </li>
                ))}
              </ul>
            </SectionCard>

            <SectionCard>
              <h2 className="mb-3 text-base font-bold">{isAr ? "التوقعات" : "Predictive layer"}</h2>
              <ul className="divide-y divide-border/60 text-sm">
                {data.predictions.map((p) => (
                  <li key={p.method + p.labelEn} className="flex justify-between py-2">
                    <span>{isAr ? p.labelAr : p.labelEn}</span>
                    <span>
                      {p.currentYearValue} → <strong>{p.predictedNextYear}</strong>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-text-light">{isAr ? "المنهجية: اتجاه خطي / افتراضات نمو موثّقة" : "Method: linear trend / documented growth assumptions"}</p>
            </SectionCard>
          </div>
        </div>
      )}
    </PageContainer>
  );
};

export default ExecutiveIntelligencePage;
