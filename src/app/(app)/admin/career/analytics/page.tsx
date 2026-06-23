"use client";

import { useCallback, useEffect, useState } from "react";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionCard from "@/components/layout/SectionCard";
import ExecutiveTalentIntelligencePanel from "@/components/talent-pathway/ExecutiveTalentIntelligencePanel";
import type { ExecutiveTalentIntelligence } from "@/lib/talent-pathway/talent-pathway-intelligence-types";
import { getLocale } from "@/lib/i18n";
import { Loader2 } from "lucide-react";

type Dashboard = {
  totalProfiles: number;
  averages: {
    careerReadiness: number;
    universityReadiness: number;
    volunteerHours: number;
    trainingHours: number;
    achievementsScore: number;
    leadershipScore: number;
    skillsScore: number;
  };
  careerReadinessBands: { high: number; medium: number; developing: number };
  universityReadinessBands: { high: number; medium: number; developing: number };
  topSkills: Array<{ name: string; count: number }>;
  topPathways: Array<{ name: string; count: number }>;
  partnershipAnalytics?: {
    totalOrganizations: number;
    activeOrganizations: number;
    ratedOrganizations: number;
    averageOrganizationRating: number;
    categoryBreakdown: Array<{ category: string; count: number; labelAr: string; labelEn: string }>;
  };
};

const CareerAnalyticsAdminPage = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [talentIntelligence, setTalentIntelligence] = useState<ExecutiveTalentIntelligence | null>(null);
  const [talentLoading, setTalentLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setTalentLoading(true);
    setError(null);
    try {
      const [res, talentRes] = await Promise.all([
        fetch("/api/admin/career/analytics", { cache: "no-store" }),
        fetch("/api/admin/talent-pathway/intelligence", { cache: "no-store" }),
      ]);
      const json = await res.json().catch(() => ({}));
      const talentJson = await talentRes.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      setDashboard(json.dashboard || null);
      setTalentIntelligence(talentRes.ok ? talentJson.intelligence || null : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setDashboard(null);
      setTalentIntelligence(null);
    } finally {
      setLoading(false);
      setTalentLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <PageContainer>
      <PageHeader
        title={isAr ? "تحليلات الجاهزية المهنية والجامعية" : "Career & university readiness analytics"}
        subtitle={
          isAr
            ? "مؤشرات الجاهزية والمهارات والمسارات عبر الطلاب."
            : "Readiness, skills, and pathway indicators across students."
        }
      />

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-text-light">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          <span>{isAr ? "جاري التحميل…" : "Loading…"}</span>
        </div>
      ) : error ? (
        <p className="text-red-600">{error}</p>
      ) : !dashboard ? (
        <p className="text-text-light">{isAr ? "لا بيانات." : "No data."}</p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: isAr ? "الملفات" : "Profiles", value: dashboard.totalProfiles },
              { label: isAr ? "متوسط الجاهزية المهنية" : "Avg career readiness", value: dashboard.averages.careerReadiness },
              { label: isAr ? "متوسط الجاهزية الجامعية" : "Avg university readiness", value: dashboard.averages.universityReadiness },
              { label: isAr ? "متوسط ساعات التطوع" : "Avg volunteer hours", value: dashboard.averages.volunteerHours },
            ].map((card) => (
              <div key={card.label} className="rounded-2xl border border-border/70 p-4">
                <p className="text-xs text-text-light">{card.label}</p>
                <p className="text-2xl font-black">{card.value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard>
              <h2 className="mb-3 text-base font-bold">{isAr ? "توزيع الجاهزية المهنية" : "Career readiness bands"}</h2>
              <ul className="space-y-1 text-sm">
                <li>{isAr ? "عالية (75+)" : "High (75+)"}: {dashboard.careerReadinessBands.high}</li>
                <li>{isAr ? "متوسطة (50–74)" : "Medium (50–74)"}: {dashboard.careerReadinessBands.medium}</li>
                <li>{isAr ? "نامية (<50)" : "Developing (<50)"}: {dashboard.careerReadinessBands.developing}</li>
              </ul>
            </SectionCard>
            <SectionCard>
              <h2 className="mb-3 text-base font-bold">{isAr ? "توزيع الجاهزية الجامعية" : "University readiness bands"}</h2>
              <ul className="space-y-1 text-sm">
                <li>{isAr ? "عالية (75+)" : "High (75+)"}: {dashboard.universityReadinessBands.high}</li>
                <li>{isAr ? "متوسطة (50–74)" : "Medium (50–74)"}: {dashboard.universityReadinessBands.medium}</li>
                <li>{isAr ? "نامية (<50)" : "Developing (<50)"}: {dashboard.universityReadinessBands.developing}</li>
              </ul>
            </SectionCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard>
              <h2 className="mb-3 text-base font-bold">{isAr ? "أفضل المهارات" : "Top skills"}</h2>
              <ul className="divide-y divide-border/60 text-sm">
                {dashboard.topSkills.map((row) => (
                  <li key={row.name} className="flex justify-between py-2">
                    <span>{row.name}</span>
                    <span className="font-bold">{row.count}</span>
                  </li>
                ))}
              </ul>
            </SectionCard>
            <SectionCard>
              <h2 className="mb-3 text-base font-bold">{isAr ? "أفضل المسارات" : "Top pathways"}</h2>
              <ul className="divide-y divide-border/60 text-sm">
                {dashboard.topPathways.map((row) => (
                  <li key={row.name} className="flex justify-between py-2">
                    <span>{row.name}</span>
                    <span className="font-bold">{row.count}</span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </div>

          {dashboard.partnershipAnalytics ? (
            <SectionCard>
              <h2 className="mb-3 text-base font-bold">
                {isAr ? "تحليلات الشراكات (إضافي)" : "Partnership analytics (additive)"}
              </h2>
              <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  {
                    label: isAr ? "المؤسسات" : "Organizations",
                    value: dashboard.partnershipAnalytics.totalOrganizations,
                  },
                  {
                    label: isAr ? "النشطة" : "Active",
                    value: dashboard.partnershipAnalytics.activeOrganizations,
                  },
                  {
                    label: isAr ? "المقيّمة" : "Rated",
                    value: dashboard.partnershipAnalytics.ratedOrganizations,
                  },
                  {
                    label: isAr ? "متوسط التقييم" : "Avg rating",
                    value: dashboard.partnershipAnalytics.averageOrganizationRating,
                  },
                ].map((card) => (
                  <div key={card.label} className="rounded-xl border border-border/60 p-3">
                    <p className="text-xs text-text-light">{card.label}</p>
                    <p className="text-xl font-bold">{card.value}</p>
                  </div>
                ))}
              </div>
              {dashboard.partnershipAnalytics.categoryBreakdown.length > 0 ? (
                <ul className="divide-y divide-border/60 text-sm">
                  {dashboard.partnershipAnalytics.categoryBreakdown.map((row) => (
                    <li key={row.category} className="flex justify-between py-2">
                      <span>{isAr ? row.labelAr : row.labelEn}</span>
                      <span className="font-bold">{row.count}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </SectionCard>
          ) : null}

          <ExecutiveTalentIntelligencePanel
            intelligence={talentIntelligence}
            loading={talentLoading}
            isAr={isAr}
          />
        </div>
      )}
    </PageContainer>
  );
};

export default CareerAnalyticsAdminPage;
