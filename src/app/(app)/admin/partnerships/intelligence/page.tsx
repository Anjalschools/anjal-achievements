"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionCard from "@/components/layout/SectionCard";
import PartnershipIntelligenceWidget from "@/components/admin/PartnershipIntelligenceWidget";
import PartnershipExecutiveIntelligencePanel from "@/components/partnerships/PartnershipExecutiveIntelligencePanel";
import type { PartnershipExecutiveIntelligence } from "@/lib/partnerships/partnership-recommendation-types";
import { getLocale } from "@/lib/i18n";
import { AlertTriangle, BarChart3, Loader2, Star, Trophy } from "lucide-react";

type RankingRow = {
  organizationId: string;
  organizationName: string;
  qualityScore: number;
  qualityLabelAr: string;
  qualityLabelEn: string;
  applicantCount: number;
  acceptedCount: number;
  completedTraineeCount: number;
  acceptanceRatePct: number;
  avgStudentRating: number;
  averageResponseTimeDays: number;
  activityScore: number;
};

type AlertRow = {
  id: string;
  type: string;
  organizationName: string;
  severity: string;
  titleAr: string;
  titleEn: string;
  detailAr: string;
  detailEn: string;
};

type Dashboard = {
  generatedAt: string;
  academicYearLabel: string;
  summary: {
    totalPartnerships: number;
    activeInstitutions: number;
    totalTrainees: number;
    avgQualityScore: number;
    bestInstitution: RankingRow | null;
    weakestInstitution: RankingRow | null;
  };
  rankings: {
    topRated: RankingRow[];
    mostActive: RankingRow[];
    highestAcceptance: RankingRow[];
    highestRated: RankingRow[];
    fastestResponse: RankingRow[];
  };
  alerts: AlertRow[];
  schoolImprovementIndicators: {
    careerReadiness: number;
    externalPartnerships: number;
    professionalExposure: number;
    studentPlacementSuccess: number;
  };
  parentConsentAnalytics: {
    required: number;
    uploaded: number;
    approved: number;
    suspiciousCount: number;
    avgConfidenceScore: number;
    outdatedDetectedCount: number;
    regeneratedCount: number;
    templateCompatibilityRate: number;
  };
  finalEvaluationAnalytics: {
    trainingSatisfactionAverage: number;
    institutionEvaluationAverage: number;
    trainingHoursTotal: number;
    trainingCompletionQualityIndex: number;
    studentRecommendationRate: number;
    employmentRecommendationRate: number;
    institutionRecommendationRate: number;
    safetyComplianceAverage: number;
    technicalSkillsAverage: number;
    studentEvaluationCount: number;
    institutionEvaluationCount: number;
    approvedCount: number;
    topTrainingInstitutions: Array<{
      institutionId: string;
      institutionName: string;
      averageScore: number;
      evaluationCount: number;
    }>;
    mostRecommendedStudents: Array<{
      studentId: string;
      averageScore: number;
      recommendEmployment: boolean;
    }>;
  };
  trainingOutcomeAnalytics: {
    avgEmployabilityScore: number;
    recommendedForEmploymentRate: number;
    outstandingTraineeCount: number;
    institutionRecommendationRate: number;
    outcomeDistribution: Record<string, number>;
    topPerformingInstitutions: Array<{
      institutionId: string;
      institutionName: string;
      avgEmployabilityScore: number;
      outcomeCount: number;
    }>;
    topPerformingStudents: Array<{
      studentId: string;
      studentName: string;
      avgEmployabilityScore: number;
      totalHours: number;
      outcomeCount: number;
    }>;
  };
  executiveWidget: {
    partnershipCount: number;
    activeInstitutions: number;
    bestInstitutionName: string;
    weakestInstitutionName: string;
    traineeCount: number;
    avgQualityScore: number;
  };
};

const RankingTable = ({
  rows,
  isAr,
  valueKey,
}: {
  rows: RankingRow[];
  isAr: boolean;
  valueKey: keyof RankingRow;
}) => (
  <div className="overflow-x-auto">
    <table className="min-w-full text-sm">
      <thead>
        <tr className="border-b border-border text-start">
          <th className="px-2 py-2">{isAr ? "المؤسسة" : "Institution"}</th>
          <th className="px-2 py-2">{isAr ? "القيمة" : "Value"}</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={2} className="px-2 py-4 text-center text-text-light">
              {isAr ? "لا توجد بيانات." : "No data."}
            </td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr key={`${valueKey}-${row.organizationId}`} className="border-b border-border/50">
              <td className="px-2 py-2">
                <Link
                  href={`/admin/partnerships/organizations/${encodeURIComponent(row.organizationId)}`}
                  className="font-semibold text-primary hover:underline"
                >
                  {row.organizationName}
                </Link>
              </td>
              <td className="px-2 py-2 font-bold">{String(row[valueKey])}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
);

const PartnershipIntelligencePage = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Dashboard | null>(null);
  const [trainingExecutive, setTrainingExecutive] = useState<{
    topTrainingPartners: Array<{ organizationId: string; organizationName: string; organizationTrainingQualityIndex: number; recommendationRatePct: number }>;
    lowestRatedPartners: Array<{ organizationId: string; organizationName: string; averageStudentSatisfaction: number; organizationTrainingQualityIndex: number }>;
    highestRecommendationRate: Array<{ organizationId: string; organizationName: string; recommendationRatePct: number }>;
    institutionQualityRanking: Array<{ organizationId: string; organizationName: string; organizationTrainingQualityIndex: number; qualityCategoryAr: string; qualityCategoryEn: string }>;
  } | null>(null);
  const [partnershipIntelligence, setPartnershipIntelligence] = useState<PartnershipExecutiveIntelligence | null>(null);
  const [partnershipIntelligenceLoading, setPartnershipIntelligenceLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setPartnershipIntelligenceLoading(true);
    setError(null);
    try {
      const [res, trainingRes, partnershipRes] = await Promise.all([
        fetch("/api/admin/partnerships/intelligence", { cache: "no-store" }),
        fetch("/api/admin/partnerships/training-intelligence", { cache: "no-store" }),
        fetch("/api/admin/partnerships/partnership-recommendations", { cache: "no-store" }),
      ]);
      const json = await res.json().catch(() => ({}));
      const trainingJson = await trainingRes.json().catch(() => ({}));
      const partnershipJson = await partnershipRes.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      setData(json.dashboard as Dashboard);
      setTrainingExecutive(trainingRes.ok ? trainingJson.analytics || null : null);
      setPartnershipIntelligence(partnershipRes.ok ? partnershipJson.intelligence || null : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setData(null);
      setPartnershipIntelligence(null);
    } finally {
      setLoading(false);
      setPartnershipIntelligenceLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const indicatorCards = data
    ? [
        { label: isAr ? "الجاهزية المهنية" : "Career readiness", value: `${data.schoolImprovementIndicators.careerReadiness}%` },
        { label: isAr ? "الشراكات الخارجية" : "External partnerships", value: `${data.schoolImprovementIndicators.externalPartnerships}%` },
        { label: isAr ? "التعرض المهني" : "Professional exposure", value: `${data.schoolImprovementIndicators.professionalExposure}%` },
        { label: isAr ? "نجاح التوظيف" : "Placement success", value: `${data.schoolImprovementIndicators.studentPlacementSuccess}%` },
      ]
    : [];

  const parentConsentCards = data?.parentConsentAnalytics
    ? [
        { label: isAr ? "موافقات مطلوبة" : "Required consents", value: data.parentConsentAnalytics.required },
        { label: isAr ? "مرفوعة" : "Uploaded", value: data.parentConsentAnalytics.uploaded },
        { label: isAr ? "معتمدة" : "Approved", value: data.parentConsentAnalytics.approved },
        { label: isAr ? "مشبوهة" : "Suspicious", value: data.parentConsentAnalytics.suspiciousCount },
        {
          label: isAr ? "متوسط الثقة" : "Avg confidence",
          value: `${data.parentConsentAnalytics.avgConfidenceScore}%`,
        },
        {
          label: isAr ? "نماذج قديمة" : "Outdated templates",
          value: data.parentConsentAnalytics.outdatedDetectedCount,
        },
        {
          label: isAr ? "إعادة إنشاء النماذج" : "Regenerated templates",
          value: data.parentConsentAnalytics.regeneratedCount,
        },
        {
          label: isAr ? "معدل توافق النماذج" : "Template compatibility",
          value: `${data.parentConsentAnalytics.templateCompatibilityRate}%`,
        },
      ]
    : [];

  const finalEvaluationCards = data?.finalEvaluationAnalytics
    ? [
        { label: isAr ? "متوسط رضا الطلاب" : "Avg student satisfaction", value: data.finalEvaluationAnalytics.trainingSatisfactionAverage },
        { label: isAr ? "متوسط تقييم المؤسسة" : "Avg institution evaluation", value: data.finalEvaluationAnalytics.institutionEvaluationAverage },
        { label: isAr ? "متوسط الالتزام بالسلامة" : "Safety compliance avg", value: data.finalEvaluationAnalytics.safetyComplianceAverage },
        { label: isAr ? "متوسط المهارات التقنية" : "Technical skills avg", value: data.finalEvaluationAnalytics.technicalSkillsAverage },
        { label: isAr ? "نسبة التوصية" : "Recommendation rate", value: `${data.finalEvaluationAnalytics.institutionRecommendationRate}%` },
        { label: isAr ? "نسبة توصية الطلاب" : "Student recommendation rate", value: `${data.finalEvaluationAnalytics.studentRecommendationRate}%` },
        { label: isAr ? "نسبة توصية التوظيف" : "Employment recommendation rate", value: `${data.finalEvaluationAnalytics.employmentRecommendationRate}%` },
        { label: isAr ? "إجمالي ساعات التدريب" : "Training hours total", value: data.finalEvaluationAnalytics.trainingHoursTotal },
        { label: isAr ? "مؤشر جودة الإكمال" : "Completion quality index", value: data.finalEvaluationAnalytics.trainingCompletionQualityIndex },
      ]
    : [];

  const trainingOutcomeCards = data?.trainingOutcomeAnalytics
    ? [
        {
          label: isAr ? "متوسط الجاهزية للتوظيف" : "Avg employability",
          value: data.trainingOutcomeAnalytics.avgEmployabilityScore,
        },
        {
          label: isAr ? "نسبة توصية التوظيف" : "Employment recommendation rate",
          value: `${data.trainingOutcomeAnalytics.recommendedForEmploymentRate}%`,
        },
        {
          label: isAr ? "متدربون متميزون" : "Outstanding trainees",
          value: data.trainingOutcomeAnalytics.outstandingTraineeCount,
        },
        {
          label: isAr ? "نسبة توصية المؤسسات" : "Institution recommendation rate",
          value: `${data.trainingOutcomeAnalytics.institutionRecommendationRate}%`,
        },
      ]
    : [];

  return (
    <PageContainer>
      <PageHeader
        title={isAr ? "ذكاء جودة الشراكات" : "Partnership quality intelligence"}
        subtitle={
          data?.academicYearLabel
            ? `${isAr ? "العام الدراسي" : "Academic year"}: ${data.academicYearLabel}`
            : isAr
              ? "قياس أداء المؤسسات الشريكة"
              : "Measure partner institution performance"
        }
      />

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-text-light">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          <span>{isAr ? "جاري التحميل…" : "Loading…"}</span>
        </div>
      ) : error && !data ? (
        <SectionCard>
          <p className="py-8 text-center text-red-600">{error}</p>
        </SectionCard>
      ) : !data ? null : (
        <>
          {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

          <SectionCard>
            <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-foreground">
              <BarChart3 className="h-4 w-4 text-primary" aria-hidden />
              {isAr ? "ملخص تنفيذي" : "Executive summary"}
            </h3>
            <PartnershipIntelligenceWidget data={data.executiveWidget} isAr={isAr} />
          </SectionCard>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <SectionCard>
              <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-foreground">
                <Trophy className="h-4 w-4 text-primary" aria-hidden />
                {isAr ? "أفضل المؤسسات (الجودة)" : "Top institutions (quality)"}
              </h3>
              <RankingTable rows={data.rankings.topRated} isAr={isAr} valueKey="qualityScore" />
            </SectionCard>

            <SectionCard>
              <h3 className="mb-3 text-base font-bold text-foreground">
                {isAr ? "الأكثر نشاطاً" : "Most active"}
              </h3>
              <RankingTable rows={data.rankings.mostActive} isAr={isAr} valueKey="activityScore" />
            </SectionCard>

            <SectionCard>
              <h3 className="mb-3 text-base font-bold text-foreground">
                {isAr ? "الأعلى قبولاً" : "Highest acceptance"}
              </h3>
              <RankingTable rows={data.rankings.highestAcceptance} isAr={isAr} valueKey="acceptanceRatePct" />
            </SectionCard>

            <SectionCard>
              <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-foreground">
                <Star className="h-4 w-4 text-primary" aria-hidden />
                {isAr ? "الأعلى تقييماً" : "Highest rated"}
              </h3>
              <RankingTable rows={data.rankings.highestRated} isAr={isAr} valueKey="avgStudentRating" />
            </SectionCard>

            <SectionCard>
              <h3 className="mb-3 text-base font-bold text-foreground">
                {isAr ? "الأسرع استجابة" : "Fastest response"}
              </h3>
              <RankingTable rows={data.rankings.fastestResponse} isAr={isAr} valueKey="averageResponseTimeDays" />
            </SectionCard>

            <SectionCard>
              <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-foreground">
                <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden />
                {isAr ? "تنبيهات تلقائية" : "Automatic alerts"}
              </h3>
              {data.alerts.length === 0 ? (
                <p className="text-sm text-text-light">{isAr ? "لا توجد تنبيهات." : "No alerts."}</p>
              ) : (
                <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
                  {data.alerts.map((alert) => (
                    <li key={alert.id} className="rounded-lg border border-border/60 px-3 py-2">
                      <p className="font-bold text-foreground">{isAr ? alert.titleAr : alert.titleEn}</p>
                      <p className="text-xs text-text-light">{isAr ? alert.detailAr : alert.detailEn}</p>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>

          <SectionCard className="mt-4">
            <h3 className="mb-3 text-base font-bold text-foreground">
              {isAr ? "مؤشرات التحسين المدرسي" : "School improvement indicators"}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {indicatorCards.map((card) => (
                <div key={card.label} className="rounded-xl border border-border/70 px-4 py-3">
                  <p className="text-xs font-bold text-text-light">{card.label}</p>
                  <p className="mt-1 text-xl font-black text-foreground">{card.value}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          {parentConsentCards.length > 0 ? (
            <SectionCard className="mt-4">
              <h3 className="mb-3 text-base font-bold text-foreground">
                {isAr ? "موافقات أولياء الأمور" : "Parent consent"}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {parentConsentCards.map((card) => (
                  <div key={card.label} className="rounded-xl border border-border/70 px-4 py-3">
                    <p className="text-xs font-bold text-text-light">{card.label}</p>
                    <p className="mt-1 text-xl font-black text-foreground">{card.value}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          ) : null}

          {finalEvaluationCards.length > 0 ? (
            <SectionCard className="mt-4">
              <h3 className="mb-3 text-base font-bold text-foreground">
                {isAr ? "التقييم النهائي للتدريب" : "Final training evaluation"}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {finalEvaluationCards.map((card) => (
                  <div key={card.label} className="rounded-xl border border-border/70 px-4 py-3">
                    <p className="text-xs font-bold text-text-light">{card.label}</p>
                    <p className="mt-1 text-xl font-black text-foreground">{card.value}</p>
                  </div>
                ))}
              </div>
              {data.finalEvaluationAnalytics.topTrainingInstitutions.length > 0 ? (
                <div className="mt-4">
                  <p className="mb-2 text-sm font-bold text-foreground">
                    {isAr ? "أفضل مؤسسات التدريب" : "Top training institutions"}
                  </p>
                  <ul className="space-y-1 text-sm text-text-light">
                    {data.finalEvaluationAnalytics.topTrainingInstitutions.map((row) => (
                      <li key={row.institutionId}>
                        {row.institutionName} — {row.averageScore}/5 ({row.evaluationCount})
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {data.finalEvaluationAnalytics.mostRecommendedStudents.length > 0 ? (
                <div className="mt-4">
                  <p className="mb-2 text-sm font-bold text-foreground">
                    {isAr ? "الطلاب الأكثر توصية" : "Most recommended students"}
                  </p>
                  <ul className="space-y-1 text-sm text-text-light">
                    {data.finalEvaluationAnalytics.mostRecommendedStudents.map((row) => (
                      <li key={row.studentId}>
                        {row.studentId.slice(-6)} — {row.averageScore}/5
                        {row.recommendEmployment ? (isAr ? " (توظيف)" : " (employment)") : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </SectionCard>
          ) : null}

          {trainingOutcomeCards.length > 0 ? (
            <SectionCard className="mt-4">
              <h3 className="mb-3 text-base font-bold text-foreground">
                {isAr ? "نتائج التدريب والجاهزية للتوظيف" : "Training outcomes & employability"}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {trainingOutcomeCards.map((card) => (
                  <div key={card.label} className="rounded-xl border border-border/70 px-4 py-3">
                    <p className="text-xs font-bold text-text-light">{card.label}</p>
                    <p className="mt-1 text-xl font-black text-foreground">{card.value}</p>
                  </div>
                ))}
              </div>
              {data.trainingOutcomeAnalytics.topPerformingInstitutions.length > 0 ? (
                <div className="mt-4">
                  <p className="mb-2 text-sm font-bold text-foreground">
                    {isAr ? "أفضل المؤسسات أداءً" : "Top performing institutions"}
                  </p>
                  <ul className="space-y-1 text-sm text-text-light">
                    {data.trainingOutcomeAnalytics.topPerformingInstitutions.slice(0, 5).map((row) => (
                      <li key={row.institutionId}>
                        {row.institutionName} — {row.avgEmployabilityScore} ({row.outcomeCount})
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </SectionCard>
          ) : null}

          {trainingExecutive ? (
            <SectionCard className="mt-4">
              <h3 className="mb-3 text-base font-bold text-foreground">
                {isAr ? "تحليلات التدريب التنفيذية" : "Executive training analytics"}
              </h3>
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <p className="mb-2 text-sm font-bold text-foreground">
                    {isAr ? "أفضل شركاء التدريب" : "Top training partners"}
                  </p>
                  <RankingTable
                    rows={trainingExecutive.topTrainingPartners.map((row) => ({
                      organizationId: row.organizationId,
                      organizationName: row.organizationName,
                      qualityScore: row.organizationTrainingQualityIndex,
                      qualityLabelAr: `${row.organizationTrainingQualityIndex}%`,
                      qualityLabelEn: `${row.organizationTrainingQualityIndex}%`,
                      applicantCount: 0,
                      acceptedCount: 0,
                      completedTraineeCount: 0,
                      acceptanceRatePct: row.recommendationRatePct,
                      avgStudentRating: 0,
                      averageResponseTimeDays: 0,
                      activityScore: row.organizationTrainingQualityIndex,
                    }))}
                    isAr={isAr}
                    valueKey="activityScore"
                  />
                </div>
                <div>
                  <p className="mb-2 text-sm font-bold text-foreground">
                    {isAr ? "أقل المؤسسات تقييماً" : "Lowest rated partners"}
                  </p>
                  <ul className="space-y-1 text-sm text-text-light">
                    {trainingExecutive.lowestRatedPartners.map((row) => (
                      <li key={row.organizationId}>
                        <Link
                          href={`/admin/partnerships/organizations/${encodeURIComponent(row.organizationId)}`}
                          className="font-semibold text-primary hover:underline"
                        >
                          {row.organizationName}
                        </Link>{" "}
                        — {row.averageStudentSatisfaction}/5 · {row.organizationTrainingQualityIndex}%
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-2 text-sm font-bold text-foreground">
                    {isAr ? "أعلى معدل توصية" : "Highest recommendation rate"}
                  </p>
                  <ul className="space-y-1 text-sm text-text-light">
                    {trainingExecutive.highestRecommendationRate.map((row) => (
                      <li key={row.organizationId}>
                        {row.organizationName} — {row.recommendationRatePct}%
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-2 text-sm font-bold text-foreground">
                    {isAr ? "ترتيب جودة المؤسسات" : "Institution quality ranking"}
                  </p>
                  <ul className="max-h-48 space-y-1 overflow-y-auto text-sm text-text-light">
                    {trainingExecutive.institutionQualityRanking.slice(0, 8).map((row, index) => (
                      <li key={row.organizationId}>
                        {index + 1}. {row.organizationName} — {row.organizationTrainingQualityIndex}% (
                        {isAr ? row.qualityCategoryAr : row.qualityCategoryEn})
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </SectionCard>
          ) : null}

          <PartnershipExecutiveIntelligencePanel
            intelligence={partnershipIntelligence}
            loading={partnershipIntelligenceLoading}
            isAr={isAr}
          />
        </>
      )}
    </PageContainer>
  );
};

export default PartnershipIntelligencePage;
