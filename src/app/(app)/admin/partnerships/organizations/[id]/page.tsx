"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionCard from "@/components/layout/SectionCard";
import { getLocale } from "@/lib/i18n";
import { PARTNER_ORGANIZATION_CATEGORY_LABELS } from "@/lib/partnerships/institution-analytics-constants";
import type { PartnerOrganizationCategory } from "@/lib/partnerships/institution-analytics-constants";
import { ArrowLeft, BarChart3, Loader2, Star } from "lucide-react";

type OrganizationStats = {
  nominatedStudents: number;
  acceptedStudents: number;
  rejectedStudents: number;
  interviewCount: number;
  inTrainingStudents: number;
  completedStudents: number;
  acceptanceRatePct: number;
  completionRatePct: number;
  rejectionRatePct: number;
  avgResponseTimeDays: number;
  avgStudentRating: number;
  chartByAcademicYear: Array<{ academicYear: string; accepted: number; rejected: number }>;
};

type InsightRow = {
  organizationId: string;
  organizationName: string;
  value: number;
  metric: string;
};

type Insights = {
  bestSatisfaction: InsightRow | null;
  highestAcceptanceRate: InsightRow | null;
  highestCompletionRate: InsightRow | null;
  fastestResponse: InsightRow | null;
};

type Organization = {
  id: string;
  name: string;
  category: string;
  subCategory: string;
  averageRating: number;
  ratingCount: number;
  sector: string;
  city: string;
};

const OrganizationAnalyticsPage = () => {
  const params = useParams();
  const id = String(params.id || "");
  const locale = getLocale();
  const isAr = locale === "ar";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [stats, setStats] = useState<OrganizationStats | null>(null);
  const [insights, setInsights] = useState<Insights | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/partnerships/organizations/${id}/analytics`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      setOrganization(json.organization || null);
      setStats(json.stats || null);
      setInsights(json.insights || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const categoryLabel =
    organization?.category &&
    PARTNER_ORGANIZATION_CATEGORY_LABELS[organization.category as PartnerOrganizationCategory]
      ? PARTNER_ORGANIZATION_CATEGORY_LABELS[organization.category as PartnerOrganizationCategory][isAr ? "ar" : "en"]
      : organization?.category || (isAr ? "—" : "—");

  const statCards = stats
    ? [
        { label: isAr ? "الطلاب المرشحون" : "Nominated students", value: stats.nominatedStudents },
        { label: isAr ? "المقبولون" : "Accepted", value: stats.acceptedStudents },
        { label: isAr ? "المرفوضون" : "Rejected", value: stats.rejectedStudents },
        { label: isAr ? "المقابلات" : "Interviews", value: stats.interviewCount },
        { label: isAr ? "قيد التدريب" : "In training", value: stats.inTrainingStudents },
        { label: isAr ? "المكتملون" : "Completed", value: stats.completedStudents },
      ]
    : [];

  const kpiCards = stats
    ? [
        { label: isAr ? "معدل القبول" : "Acceptance rate", value: `${stats.acceptanceRatePct}%` },
        { label: isAr ? "معدل الإكمال" : "Completion rate", value: `${stats.completionRatePct}%` },
        { label: isAr ? "معدل الرفض" : "Rejection rate", value: `${stats.rejectionRatePct}%` },
        {
          label: isAr ? "متوسط زمن الاستجابة" : "Avg response time",
          value: `${stats.avgResponseTimeDays} ${isAr ? "يوم" : "days"}`,
        },
        {
          label: isAr ? "متوسط تقييم الطلاب" : "Avg student rating",
          value: stats.avgStudentRating > 0 ? `${stats.avgStudentRating}/5` : "—",
        },
      ]
    : [];

  const formatInsight = (row: InsightRow | null, suffix: string) => {
    if (!row) return isAr ? "لا بيانات كافية" : "Insufficient data";
    const isCurrent = row.organizationId === id;
    return `${row.organizationName}${isCurrent ? (isAr ? " (هذه المؤسسة)" : " (this org)") : ""}: ${row.value}${suffix}`;
  };

  const chartMax = stats?.chartByAcademicYear.reduce(
    (max, row) => Math.max(max, row.accepted, row.rejected),
    1
  ) || 1;

  return (
    <PageContainer>
      <div className="mb-4">
        <Link
          href="/admin/partnerships"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {isAr ? "العودة للشراكات" : "Back to partnerships"}
        </Link>
      </div>

      <PageHeader
        title={isAr ? "إحصائيات المؤسسة" : "Organization performance"}
        subtitle={
          organization
            ? `${organization.name}${organization.city ? ` · ${organization.city}` : ""}`
            : isAr
              ? "تحميل…"
              : "Loading…"
        }
      />

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-text-light">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          <span>{isAr ? "جاري التحميل…" : "Loading…"}</span>
        </div>
      ) : error ? (
        <p className="text-red-600">{error}</p>
      ) : !organization || !stats ? (
        <p className="text-text-light">{isAr ? "لا بيانات." : "No data."}</p>
      ) : (
        <div className="space-y-4">
          <SectionCard>
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <p className="text-sm text-text-light">{isAr ? "التصنيف" : "Category"}</p>
                <p className="font-semibold">{categoryLabel}</p>
                {organization.subCategory ? (
                  <p className="text-xs text-text-light">{organization.subCategory}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 text-amber-500" aria-hidden />
                <span className="font-semibold">
                  {organization.averageRating > 0
                    ? `${organization.averageRating}/5 (${organization.ratingCount})`
                    : isAr
                      ? "لا تقييمات بعد"
                      : "No ratings yet"}
                </span>
              </div>
            </div>
          </SectionCard>

          <SectionCard>
            <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-foreground">
              <BarChart3 className="h-5 w-5" aria-hidden />
              {isAr ? "إحصائيات المؤسسة" : "Organization statistics"}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {statCards.map((card) => (
                <div key={card.label} className="rounded-xl border border-border/60 bg-surface/50 p-4">
                  <p className="text-xs text-text-light">{card.label}</p>
                  <p className="text-2xl font-bold text-foreground">{card.value}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard>
            <h2 className="mb-4 text-base font-bold text-foreground">
              {isAr ? "مؤشرات الأداء" : "Performance indicators"}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {kpiCards.map((card) => (
                <div key={card.label} className="rounded-xl border border-border/60 p-4">
                  <p className="text-xs text-text-light">{card.label}</p>
                  <p className="text-xl font-bold text-primary">{card.value}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard>
            <h2 className="mb-4 text-base font-bold text-foreground">
              {isAr ? "قبول / رفض حسب العام الدراسي" : "Accept / reject by academic year"}
            </h2>
            {stats.chartByAcademicYear.length === 0 ? (
              <p className="text-sm text-text-light">{isAr ? "لا بيانات." : "No data."}</p>
            ) : (
              <div className="space-y-4">
                {stats.chartByAcademicYear.map((row) => (
                  <div key={row.academicYear}>
                    <p className="mb-2 text-sm font-semibold">{row.academicYear}</p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="w-16 text-xs text-green-700">{isAr ? "قبول" : "Accept"}</span>
                        <div className="h-4 flex-1 rounded bg-border/40">
                          <div
                            className="h-4 rounded bg-green-500"
                            style={{ width: `${Math.max(4, (row.accepted / chartMax) * 100)}%` }}
                          />
                        </div>
                        <span className="w-8 text-xs">{row.accepted}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-16 text-xs text-red-700">{isAr ? "رفض" : "Reject"}</span>
                        <div className="h-4 flex-1 rounded bg-border/40">
                          <div
                            className="h-4 rounded bg-red-400"
                            style={{ width: `${Math.max(4, (row.rejected / chartMax) * 100)}%` }}
                          />
                        </div>
                        <span className="w-8 text-xs">{row.rejected}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {insights ? (
            <SectionCard>
              <h2 className="mb-4 text-base font-bold text-foreground">
                {isAr ? "رؤى الأداء" : "Performance insights"}
              </h2>
              <ul className="space-y-2 text-sm">
                <li>
                  <span className="font-semibold">{isAr ? "أفضل مؤسسة من حيث الرضا: " : "Best satisfaction: "}</span>
                  {formatInsight(insights.bestSatisfaction, "/5")}
                </li>
                <li>
                  <span className="font-semibold">{isAr ? "أعلى معدل قبول: " : "Highest acceptance: "}</span>
                  {formatInsight(insights.highestAcceptanceRate, "%")}
                </li>
                <li>
                  <span className="font-semibold">{isAr ? "أعلى معدل إكمال: " : "Highest completion: "}</span>
                  {formatInsight(insights.highestCompletionRate, "%")}
                </li>
                <li>
                  <span className="font-semibold">{isAr ? "أسرع استجابة: " : "Fastest response: "}</span>
                  {formatInsight(insights.fastestResponse, isAr ? " يوم" : " days")}
                </li>
              </ul>
            </SectionCard>
          ) : null}
        </div>
      )}
    </PageContainer>
  );
};

export default OrganizationAnalyticsPage;
