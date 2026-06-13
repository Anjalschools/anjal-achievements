"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionCard from "@/components/layout/SectionCard";
import { getLocale } from "@/lib/i18n";
import { Award, Building2, Clock3, Loader2, Users } from "lucide-react";

type TrainingAchievementRow = {
  recordId: string;
  achievementId: string | null;
  studentName: string;
  studentStage: string;
  organizationName: string;
  opportunityTitle: string;
  volunteerHours: number | null;
  academicYear: string;
  achievementStatus: string | null;
  certificateIssued: boolean;
  certificateDisplayId: string | null;
  certificateVerifyPath: string | null;
};

type Dashboard = {
  traineeCount: number;
  organizationCount: number;
  totalHours: number;
  summerTrainingAchievementCount: number;
  byStage: Array<{ key: string; count: number }>;
  byOrganization: Array<{ key: string; count: number }>;
};

const stageLabel = (value: string, isAr: boolean) => {
  const map: Record<string, { ar: string; en: string }> = {
    elementary: { ar: "ابتدائي", en: "Elementary" },
    middle: { ar: "متوسط", en: "Middle" },
    high: { ar: "ثانوي", en: "High" },
    unknown: { ar: "غير محدد", en: "Unknown" },
  };
  return map[value]?.[isAr ? "ar" : "en"] || value;
};

const PartnershipsTrainingAchievementsPage = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<TrainingAchievementRow[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard>({
    traineeCount: 0,
    organizationCount: 0,
    totalHours: 0,
    summerTrainingAchievementCount: 0,
    byStage: [],
    byOrganization: [],
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/training-achievements", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      setItems(Array.isArray(json.items) ? json.items : []);
      if (json.dashboard) setDashboard(json.dashboard as Dashboard);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PageContainer>
      <PageHeader
        title={isAr ? "إنجازات وشهادات التدريب" : "Training achievements & certificates"}
        subtitle={
          isAr
            ? "الإنجازات والشهادات المُنشأة تلقائياً بعد اعتماد التقارير."
            : "Achievements and certificates auto-created after report approval."
        }
      />

      <div className="mb-4">
        <Link href="/admin/partnerships/final-reports" className="text-sm font-bold text-primary underline">
          {isAr ? "تقارير التدريب" : "Training reports"}
        </Link>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SectionCard className="!p-4">
          <p className="flex items-center gap-1 text-xs text-slate-500">
            <Users className="h-4 w-4" aria-hidden />
            {isAr ? "عدد المتدربين" : "Trainees"}
          </p>
          <p className="text-2xl font-black">{dashboard.traineeCount}</p>
        </SectionCard>
        <SectionCard className="!p-4">
          <p className="flex items-center gap-1 text-xs text-slate-500">
            <Building2 className="h-4 w-4" aria-hidden />
            {isAr ? "عدد المؤسسات" : "Organizations"}
          </p>
          <p className="text-2xl font-black">{dashboard.organizationCount}</p>
        </SectionCard>
        <SectionCard className="!p-4">
          <p className="flex items-center gap-1 text-xs text-slate-500">
            <Clock3 className="h-4 w-4" aria-hidden />
            {isAr ? "إجمالي الساعات" : "Total hours"}
          </p>
          <p className="text-2xl font-black">{dashboard.totalHours}</p>
        </SectionCard>
        <SectionCard className="!p-4">
          <p className="flex items-center gap-1 text-xs text-slate-500">
            <Award className="h-4 w-4" aria-hidden />
            {isAr ? "إنجازات التدريب" : "Training achievements"}
          </p>
          <p className="text-2xl font-black">{dashboard.summerTrainingAchievementCount}</p>
        </SectionCard>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <SectionCard>
          <h2 className="mb-2 text-sm font-black text-slate-900">
            {isAr ? "التوزيع حسب المرحلة" : "Distribution by stage"}
          </h2>
          <ul className="space-y-1 text-sm">
            {dashboard.byStage.map((row) => (
              <li key={row.key} className="flex justify-between">
                <span>{stageLabel(row.key, isAr)}</span>
                <span className="font-bold">{row.count}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
        <SectionCard>
          <h2 className="mb-2 text-sm font-black text-slate-900">
            {isAr ? "التوزيع حسب المؤسسة" : "Distribution by organization"}
          </h2>
          <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
            {dashboard.byOrganization.map((row) => (
              <li key={row.key} className="flex justify-between gap-2">
                <span className="truncate">{row.key}</span>
                <span className="font-bold">{row.count}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
        </div>
      ) : (
        <SectionCard>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-start text-xs text-slate-500">
                  <th className="px-2 py-2">{isAr ? "الطالب" : "Student"}</th>
                  <th className="px-2 py-2">{isAr ? "المؤسسة" : "Organization"}</th>
                  <th className="px-2 py-2">{isAr ? "الساعات" : "Hours"}</th>
                  <th className="px-2 py-2">{isAr ? "حالة الإنجاز" : "Achievement"}</th>
                  <th className="px-2 py-2">{isAr ? "الشهادة" : "Certificate"}</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-2 py-8 text-center text-slate-500">
                      {isAr ? "لا توجد إنجازات تدريب بعد." : "No training achievements yet."}
                    </td>
                  </tr>
                ) : (
                  items.map((row) => (
                    <tr key={row.recordId} className="border-b border-slate-100">
                      <td className="px-2 py-3">
                        <p className="font-bold text-slate-900">{row.studentName}</p>
                        <p className="text-xs text-slate-500">{row.opportunityTitle}</p>
                      </td>
                      <td className="px-2 py-3">{row.organizationName}</td>
                      <td className="px-2 py-3">{row.volunteerHours ?? "—"}</td>
                      <td className="px-2 py-3">
                        {row.achievementId ? (
                          <Link
                            href={`/achievements/${row.achievementId}`}
                            className="font-bold text-primary underline"
                          >
                            {row.achievementStatus || "approved"}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-2 py-3">
                        {row.certificateIssued && row.certificateVerifyPath ? (
                          <a
                            href={row.certificateVerifyPath}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold text-primary underline"
                          >
                            {row.certificateDisplayId || (isAr ? "عرض" : "View")}
                          </a>
                        ) : (
                          isAr ? "—" : "—"
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </PageContainer>
  );
};

export default PartnershipsTrainingAchievementsPage;
