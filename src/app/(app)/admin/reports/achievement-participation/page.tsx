"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import { getLocale } from "@/lib/i18n";
import { exportLandscapeExecutivePdfView, exportRowsToExcelWorkbook } from "@/lib/report-export";
import {
  getReportCategoryOptions,
  getReportLevelOptions,
  getReportResultOptions,
} from "@/lib/report-filter-options";
import { GRADE_OPTIONS } from "@/constants/grades";
import { Loader2, RefreshCw } from "lucide-react";
import type { ParticipationActivityRow, ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";

const MiniHBar = ({
  label,
  value,
  max,
  isAr,
}: {
  label: string;
  value: number;
  max: number;
  isAr: boolean;
}) => {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px] font-bold text-slate-600">
        <span className="truncate">{label}</span>
        <span className="tabular-nums text-slate-900">{value}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100" dir={isAr ? "rtl" : "ltr"}>
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const AdminParticipationAnalyticsPage = () => {
  const router = useRouter();
  const locale = getLocale();
  const isAr = locale === "ar";
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [data, setData] = useState<ParticipationAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [f, setF] = useState({
    academicYear: "2025-2026م",
    gender: "all",
    mawhiba: "all",
    stage: "all",
    grade: "all",
    section: "all",
    categories: [] as string[],
    levels: [] as string[],
    resultTokens: [] as string[],
    status: "all",
    certificateStatus: "all",
    fromDate: "",
    toDate: "",
    domain: "",
    classification: "",
    organization: "",
  });

  const categoryOptions = useMemo(() => getReportCategoryOptions(isAr ? "ar" : "en"), [isAr]);
  const levelOptions = useMemo(() => getReportLevelOptions(isAr ? "ar" : "en"), [isAr]);
  const resultOptions = useMemo(() => getReportResultOptions(isAr ? "ar" : "en"), [isAr]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/user/profile", { cache: "no-store" });
        if (!res.ok) {
          setAllowed(false);
          return;
        }
        const j = await res.json();
        const role = String(j.role || "");
        setAllowed(["admin", "supervisor", "schoolAdmin", "teacher", "judge"].includes(role));
      } catch {
        setAllowed(false);
      }
    })();
  }, []);

  const buildQuery = useCallback(() => {
    const sp = new URLSearchParams();
    sp.set("academicYear", f.academicYear);
    sp.set("gender", f.gender);
    sp.set("mawhiba", f.mawhiba);
    sp.set("stage", f.stage);
    sp.set("grade", f.grade);
    sp.set("section", f.section);
    if (f.categories.length) sp.set("category", f.categories.join(","));
    if (f.levels.length) sp.set("level", f.levels.join(","));
    if (f.resultTokens.length) sp.set("result", f.resultTokens.join(","));
    sp.set("status", f.status);
    sp.set("certificateStatus", f.certificateStatus);
    if (f.fromDate) sp.set("fromDate", f.fromDate);
    if (f.toDate) sp.set("toDate", f.toDate);
    if (f.domain.trim()) sp.set("domain", f.domain.trim());
    if (f.classification.trim()) sp.set("classification", f.classification.trim());
    if (f.organization.trim()) sp.set("organization", f.organization.trim());
    sp.set("page", String(page));
    sp.set("pageSize", "25");
    return sp.toString();
  }, [f, page]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reports/achievement-participation?${buildQuery()}`, {
        cache: "no-store",
        credentials: "include",
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (res.status === 403) {
        setAllowed(false);
        return;
      }
      const j = (await res.json()) as ParticipationAnalyticsPayload & { error?: string };
      if (!res.ok || !j.ok) {
        throw new Error(typeof j.error === "string" ? j.error : "Request failed");
      }
      setData(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [buildQuery, router]);

  useEffect(() => {
    if (allowed !== true) return;
    void fetchData();
  }, [allowed, fetchData]);

  const title = isAr ? "تقرير إحصائيات المشاركات والإنجازات" : "Achievement Participation Analytics Report";

  const headers = useMemo(
    () =>
      isAr
        ? [
            "النشاط",
            "النوع",
            "المستوى",
            "نتيجة المشاركة",
            "إجمالي المشاركين",
            "بنين",
            "بنات",
            "عربي",
            "دولي",
            "موهبة",
            "غير موهبة",
            "نسبة التميز %",
            "إنجازات معتمدة",
            "مشاركات",
          ]
        : [
            "Activity",
            "Type",
            "Level",
            "Participation result",
            "Distinct participants",
            "Boys",
            "Girls",
            "Arabic",
            "International",
            "Mawhiba",
            "Non‑Mawhiba",
            "Excellence rate %",
            "Approved achievements",
            "Total rows",
          ],
    [isAr]
  );

  const tableRows = useMemo(() => {
    if (!data?.table) return [];
    return data.table.map((r: ParticipationActivityRow) => {
      const base = isAr
        ? {
            النشاط: r.activityLabelAr,
            النوع: r.typeLabelAr,
            المستوى: r.levelLabelAr,
            "نتيجة المشاركة": r.participationResultAr,
            "إجمالي المشاركين": r.distinctParticipants,
            بنين: r.maleParticipants,
            بنات: r.femaleParticipants,
            عربي: r.arabicParticipants,
            دولي: r.internationalParticipants,
            موهبة: r.mawhibaParticipants,
            "غير موهبة": r.nonMawhibaParticipants,
            "نسبة التميز %": r.excellenceRatePct,
            "إنجازات معتمدة": r.approvedAchievements,
            مشاركات: r.totalParticipations,
          }
        : {
            Activity: r.activityLabelEn,
            Type: r.typeLabelEn,
            Level: r.levelLabelEn,
            "Participation result": r.participationResultEn,
            "Distinct participants": r.distinctParticipants,
            Boys: r.maleParticipants,
            Girls: r.femaleParticipants,
            Arabic: r.arabicParticipants,
            International: r.internationalParticipants,
            Mawhiba: r.mawhibaParticipants,
            "Non‑Mawhiba": r.nonMawhibaParticipants,
            "Excellence rate %": r.excellenceRatePct,
            "Approved achievements": r.approvedAchievements,
            "Total rows": r.totalParticipations,
          };
    return base as unknown as Record<string, string | number>;
    });
  }, [data, isAr]);

  const kpi = data?.kpis;

  const summaryLines = useMemo(() => {
    if (!kpi) return [];
    return isAr
      ? [
          `إجمالي المشاركات: ${kpi.totalParticipations}`,
          `طلاب مشاركون (فريدون): ${kpi.distinctStudents}`,
          `نسبة مشاركات موهبة: ${kpi.mawhibaParticipationPct}%`,
          `نسبة البنات (سجلات): ${kpi.femalePct}%`,
          `نسبة القسم الدولي (سجلات): ${kpi.internationalSectionPct}%`,
          `ميداليات ذهبية: ${kpi.goldMedalCount}`,
          `مراكز أولى: ${kpi.firstPlaceCount}`,
          `ترشيحات: ${kpi.nominationCount}`,
          `أعلى مستوى: ${kpi.highestLevelLabelAr}`,
          `برامج نشطة في الجدول: ${kpi.activeProgramsCount}`,
        ]
      : [
          `Total participation records: ${kpi.totalParticipations}`,
          `Distinct students: ${kpi.distinctStudents}`,
          `Mawhiba participation %: ${kpi.mawhibaParticipationPct}%`,
          `Female share (records): ${kpi.femalePct}%`,
          `International section share (records): ${kpi.internationalSectionPct}%`,
          `Gold medals: ${kpi.goldMedalCount}`,
          `First places: ${kpi.firstPlaceCount}`,
          `Nominations: ${kpi.nominationCount}`,
          `Highest level: ${kpi.highestLevelLabelEn}`,
          `Active programs (table): ${kpi.activeProgramsCount}`,
        ];
  }, [kpi, isAr]);

  const handleExcel = () =>
    void exportRowsToExcelWorkbook(tableRows, headers, title, "participation-analytics", { rtlSheet: isAr });

  const handlePdf = () => void exportLandscapeExecutivePdfView(summaryLines, tableRows, headers, title, "/report-header.png");

  const genderMax = useMemo(
    () => Math.max(1, ...(data?.charts.genderParticipation.map((x) => x.count) || [0])),
    [data]
  );
  const sectionMax = useMemo(
    () => Math.max(1, ...(data?.charts.sectionParticipation.map((x) => x.count) || [0])),
    [data]
  );
  const mawMax = useMemo(() => Math.max(1, ...(data?.charts.mawhibaSplit.map((x) => x.count) || [0])), [data]);
  const resultMax = useMemo(() => Math.max(1, ...(data?.charts.resultDistribution.map((x) => x.count) || [0])), [data]);
  const levelMax = useMemo(() => Math.max(1, ...(data?.charts.levelDistribution.map((x) => x.count) || [0])), [data]);
  const horizMax = useMemo(
    () => Math.max(1, ...(data?.charts.activityHorizontal.map((x) => x.studentCount) || [0])),
    [data]
  );

  const totalPages = data ? Math.max(1, Math.ceil(data.tableTotal / data.pageSize)) : 1;

  if (allowed === false) {
    return (
      <PageContainer>
        <p className="p-6 text-sm text-red-700">
          {isAr ? "غير مصرح لك بعرض هذا التقرير." : "You are not allowed to view this report."}
        </p>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div dir={isAr ? "rtl" : "ltr"}>
        <PageHeader
          title={title}
          subtitle={
            isAr
              ? "إحصائيات المشاركات حسب النشاط مع مقارنات الجنس والقسم وموهبة، وعرض المستوى ونتيجة المشاركة."
              : "Participation metrics by activity with gender, section, and Mawhiba splits, plus level and result summaries."
          }
          actions={
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void fetchData()}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-text shadow-sm hover:bg-gray-50 disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {isAr ? "تحديث" : "Refresh"}
              </button>
              <button
                type="button"
                onClick={handlePdf}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-text shadow-sm hover:bg-gray-50"
              >
                PDF
              </button>
              <button
                type="button"
                onClick={handleExcel}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-text shadow-sm hover:bg-gray-50"
              >
                Excel
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-text shadow-sm hover:bg-gray-50"
              >
                {isAr ? "طباعة" : "Print"}
              </button>
            </div>
          }
        />

        <div className="mb-4 flex flex-wrap gap-3 text-sm print:hidden">
          <Link href="/admin/achievements/reports" className="font-semibold text-primary hover:underline">
            {isAr ? "← تقارير الإنجازات التفصيلية" : "← Detailed achievement reports"}
          </Link>
          <Link href="/admin/analytics" className="font-semibold text-primary hover:underline">
            {isAr ? "الإحصاءات المتقدمة" : "Advanced analytics"}
          </Link>
        </div>

        <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 print:hidden">
          <h2 className="text-sm font-black text-slate-900">{isAr ? "الفلاتر" : "Filters"}</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col text-xs font-semibold text-slate-600">
              {isAr ? "العام الدراسي" : "Academic year"}
              <select
                value={f.academicYear}
                onChange={(e) => {
                  setPage(1);
                  setF((p) => ({ ...p, academicYear: e.target.value }));
                }}
                className="mt-1 rounded-lg border border-slate-200 px-2 py-2 text-sm"
              >
                <option value="2025-2026م">2025-2026م</option>
                <option value="2024-2025م">2024-2025م</option>
                <option value="2023-2024م">2023-2024م</option>
              </select>
            </label>
            <label className="flex flex-col text-xs font-semibold text-slate-600">
              {isAr ? "الجنس" : "Gender"}
              <select
                value={f.gender}
                onChange={(e) => {
                  setPage(1);
                  setF((p) => ({ ...p, gender: e.target.value }));
                }}
                className="mt-1 rounded-lg border border-slate-200 px-2 py-2 text-sm"
              >
                <option value="all">{isAr ? "الكل" : "All"}</option>
                <option value="male">{isAr ? "بنين" : "Boys"}</option>
                <option value="female">{isAr ? "بنات" : "Girls"}</option>
              </select>
            </label>
            <label className="flex flex-col text-xs font-semibold text-slate-600">
              {isAr ? "القسم" : "Section"}
              <select
                value={f.section}
                onChange={(e) => {
                  setPage(1);
                  setF((p) => ({ ...p, section: e.target.value }));
                }}
                className="mt-1 rounded-lg border border-slate-200 px-2 py-2 text-sm"
              >
                <option value="all">{isAr ? "الكل" : "All"}</option>
                <option value="arabic">{isAr ? "عربي" : "Arabic"}</option>
                <option value="international">{isAr ? "دولي" : "International"}</option>
              </select>
            </label>
            <label className="flex flex-col text-xs font-semibold text-slate-600">
              {isAr ? "موهبة" : "Mawhiba"}
              <select
                value={f.mawhiba}
                onChange={(e) => {
                  setPage(1);
                  setF((p) => ({ ...p, mawhiba: e.target.value }));
                }}
                className="mt-1 rounded-lg border border-slate-200 px-2 py-2 text-sm"
              >
                <option value="all">{isAr ? "الكل" : "All"}</option>
                <option value="yes">{isAr ? "موهبة" : "Mawhiba"}</option>
                <option value="no">{isAr ? "غير موهبة" : "Non‑Mawhiba"}</option>
              </select>
            </label>
            <label className="flex flex-col text-xs font-semibold text-slate-600">
              {isAr ? "المرحلة" : "Stage"}
              <select
                value={f.stage}
                onChange={(e) => {
                  setPage(1);
                  setF((p) => ({ ...p, stage: e.target.value }));
                }}
                className="mt-1 rounded-lg border border-slate-200 px-2 py-2 text-sm"
              >
                <option value="all">{isAr ? "الكل" : "All"}</option>
                <option value="primary">{isAr ? "ابتدائي" : "Primary"}</option>
                <option value="middle">{isAr ? "متوسط" : "Middle"}</option>
                <option value="secondary">{isAr ? "ثانوي" : "Secondary"}</option>
              </select>
            </label>
            <label className="flex flex-col text-xs font-semibold text-slate-600">
              {isAr ? "الصف" : "Grade"}
              <select
                value={f.grade}
                onChange={(e) => {
                  setPage(1);
                  setF((p) => ({ ...p, grade: e.target.value }));
                }}
                className="mt-1 rounded-lg border border-slate-200 px-2 py-2 text-sm"
              >
                <option value="all">{isAr ? "الكل" : "All"}</option>
                {GRADE_OPTIONS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {isAr ? g.ar : g.en}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-xs font-semibold text-slate-600">
              {isAr ? "حالة الإنجاز" : "Achievement status"}
              <select
                value={f.status}
                onChange={(e) => {
                  setPage(1);
                  setF((p) => ({ ...p, status: e.target.value }));
                }}
                className="mt-1 rounded-lg border border-slate-200 px-2 py-2 text-sm"
              >
                <option value="all">{isAr ? "الكل" : "All"}</option>
                <option value="approved">{isAr ? "معتمد" : "Approved"}</option>
                <option value="pending">{isAr ? "قيد المراجعة" : "Pending"}</option>
                <option value="pending_review">{isAr ? "قيد المراجعة" : "Pending review"}</option>
                <option value="needs_revision">{isAr ? "يحتاج تعديل" : "Needs revision"}</option>
                <option value="rejected">{isAr ? "مرفوض" : "Rejected"}</option>
              </select>
            </label>
            <label className="flex flex-col text-xs font-semibold text-slate-600">
              {isAr ? "الشهادة" : "Certificate"}
              <select
                value={f.certificateStatus}
                onChange={(e) => {
                  setPage(1);
                  setF((p) => ({ ...p, certificateStatus: e.target.value }));
                }}
                className="mt-1 rounded-lg border border-slate-200 px-2 py-2 text-sm"
              >
                <option value="all">{isAr ? "الكل" : "All"}</option>
                <option value="issued">{isAr ? "صادرة" : "Issued"}</option>
                <option value="not_issued">{isAr ? "غير صادرة" : "Not issued"}</option>
              </select>
            </label>
            <label className="flex flex-col text-xs font-semibold text-slate-600">
              {isAr ? "من تاريخ" : "From date"}
              <input
                type="date"
                value={f.fromDate}
                onChange={(e) => {
                  setPage(1);
                  setF((p) => ({ ...p, fromDate: e.target.value }));
                }}
                className="mt-1 rounded-lg border border-slate-200 px-2 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col text-xs font-semibold text-slate-600">
              {isAr ? "إلى تاريخ" : "To date"}
              <input
                type="date"
                value={f.toDate}
                onChange={(e) => {
                  setPage(1);
                  setF((p) => ({ ...p, toDate: e.target.value }));
                }}
                className="mt-1 rounded-lg border border-slate-200 px-2 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col text-xs font-semibold text-slate-600 md:col-span-2">
              {isAr ? "بحث في المجال / الاسم / المستنتج" : "Domain / name / inferred search"}
              <input
                value={f.domain}
                onChange={(e) => {
                  setPage(1);
                  setF((p) => ({ ...p, domain: e.target.value }));
                }}
                className="mt-1 rounded-lg border border-slate-200 px-2 py-2 text-sm"
                placeholder={isAr ? "نص جزئي…" : "Partial text…"}
              />
            </label>
            <label className="flex flex-col text-xs font-semibold text-slate-600">
              {isAr ? "تصنيف المادة" : "Classification"}
              <input
                value={f.classification}
                onChange={(e) => {
                  setPage(1);
                  setF((p) => ({ ...p, classification: e.target.value }));
                }}
                className="mt-1 rounded-lg border border-slate-200 px-2 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col text-xs font-semibold text-slate-600 md:col-span-2">
              {isAr ? "جهة / منظمة" : "Organization"}
              <input
                value={f.organization}
                onChange={(e) => {
                  setPage(1);
                  setF((p) => ({ ...p, organization: e.target.value }));
                }}
                className="mt-1 rounded-lg border border-slate-200 px-2 py-2 text-sm"
              />
            </label>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-3">
            <div>
              <p className="text-xs font-bold text-slate-600">{isAr ? "أنواع الأنشطة" : "Activity types"}</p>
              <div className="mt-1 max-h-28 overflow-y-auto rounded-lg border border-slate-100 p-2 text-xs">
                {categoryOptions.map((o) => (
                  <label key={o.value} className="flex cursor-pointer items-center gap-2 py-0.5">
                    <input
                      type="checkbox"
                      checked={f.categories.includes(o.value)}
                      onChange={(e) => {
                        setPage(1);
                        setF((p) => ({
                          ...p,
                          categories: e.target.checked
                            ? [...p.categories, o.value]
                            : p.categories.filter((x) => x !== o.value),
                        }));
                      }}
                    />
                    <span>{o.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-600">{isAr ? "مستوى الإنجاز" : "Achievement level"}</p>
              <div className="mt-1 max-h-28 overflow-y-auto rounded-lg border border-slate-100 p-2 text-xs">
                {levelOptions.map((o) => (
                  <label key={o.value} className="flex cursor-pointer items-center gap-2 py-0.5">
                    <input
                      type="checkbox"
                      checked={f.levels.includes(o.value)}
                      onChange={(e) => {
                        setPage(1);
                        setF((p) => ({
                          ...p,
                          levels: e.target.checked
                            ? [...p.levels, o.value]
                            : p.levels.filter((x) => x !== o.value),
                        }));
                      }}
                    />
                    <span>{o.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-600">{isAr ? "النتيجة" : "Result"}</p>
              <div className="mt-1 max-h-28 overflow-y-auto rounded-lg border border-slate-100 p-2 text-xs">
                {resultOptions.map((o) => (
                  <label key={o.value} className="flex cursor-pointer items-center gap-2 py-0.5">
                    <input
                      type="checkbox"
                      checked={f.resultTokens.includes(o.value)}
                      onChange={(e) => {
                        setPage(1);
                        setF((p) => ({
                          ...p,
                          resultTokens: e.target.checked
                            ? [...p.resultTokens, o.value]
                            : p.resultTokens.filter((x) => x !== o.value),
                        }));
                      }}
                    />
                    <span>{o.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </section>

        {error ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
        ) : null}

        {allowed === true && !data && loading ? (
          <div className="flex items-center gap-2 py-12 text-slate-600">
            <Loader2 className="h-5 w-5 animate-spin" />
            {isAr ? "جاري التحميل…" : "Loading…"}
          </div>
        ) : null}

        {data && kpi ? (
          <>
            <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                [isAr ? "إجمالي المشاركات" : "Total participations", kpi.totalParticipations],
                [isAr ? "طلاب مشاركون (فريدون)" : "Distinct students", kpi.distinctStudents],
                [isAr ? "نسبة موهبة (سجلات)" : "Mawhiba % (records)", `${kpi.mawhibaParticipationPct}%`],
                [isAr ? "نسبة البنات" : "Female %", `${kpi.femalePct}%`],
                [isAr ? "قسم دولي %" : "Intl. section %", `${kpi.internationalSectionPct}%`],
                [isAr ? "ذهبية" : "Gold medals", kpi.goldMedalCount],
                [isAr ? "مراكز أولى" : "First places", kpi.firstPlaceCount],
                [isAr ? "ترشيحات" : "Nominations", kpi.nominationCount],
                [isAr ? "أعلى مستوى" : "Highest level", isAr ? kpi.highestLevelLabelAr : kpi.highestLevelLabelEn],
                [isAr ? "إنجازات دولية %" : "Intl. achievements %", `${kpi.internationalAchievementPct}%`],
                [isAr ? "إنجازات عالمية %" : "Global achievements %", `${kpi.globalAchievementPct}%`],
                [isAr ? "أعلى برنامج" : "Top program", isAr ? kpi.topProgramLabelAr : kpi.topProgramLabelEn],
              ].map(([k, v]) => (
                <div key={String(k)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-bold text-slate-500">{k}</p>
                  <p className="mt-1 text-lg font-black text-slate-900">{v}</p>
                </div>
              ))}
            </section>

            <section className="mb-6 grid gap-4 lg:grid-cols-2 print:grid-cols-1">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-black text-slate-900">{isAr ? "الجنس" : "Gender"}</h3>
                <div className="mt-3 space-y-2">
                  {data.charts.genderParticipation.map((r) => (
                    <MiniHBar key={r.key} label={isAr ? r.labelAr : r.labelEn} value={r.count} max={genderMax} isAr={isAr} />
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-black text-slate-900">{isAr ? "القسم" : "Section"}</h3>
                <div className="mt-3 space-y-2">
                  {data.charts.sectionParticipation.map((r) => (
                    <MiniHBar key={r.key} label={isAr ? r.labelAr : r.labelEn} value={r.count} max={sectionMax} isAr={isAr} />
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-black text-slate-900">{isAr ? "موهبة" : "Mawhiba"}</h3>
                <div className="mt-3 space-y-2">
                  {data.charts.mawhibaSplit.map((r) => (
                    <MiniHBar key={r.key} label={isAr ? r.labelAr : r.labelEn} value={r.count} max={mawMax} isAr={isAr} />
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-black text-slate-900">{isAr ? "توزيع النتائج" : "Result mix"}</h3>
                <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
                  {data.charts.resultDistribution.map((r, i) => (
                    <MiniHBar
                      key={`${r.labelAr}-${i}`}
                      label={isAr ? r.labelAr : r.labelEn}
                      value={r.count}
                      max={resultMax}
                      isAr={isAr}
                    />
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-black text-slate-900">{isAr ? "توزيع المستويات" : "Levels"}</h3>
                <div className="mt-3 space-y-2">
                  {data.charts.levelDistribution.map((r, i) => (
                    <MiniHBar
                      key={`${r.labelAr}-${i}`}
                      label={isAr ? r.labelAr : r.labelEn}
                      value={r.count}
                      max={levelMax}
                      isAr={isAr}
                    />
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
                <h3 className="text-sm font-black text-slate-900">
                  {isAr ? "أعلى الأنشطة (طلاب فريدون)" : "Top activities (distinct students)"}
                </h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {data.charts.activityHorizontal.map((r, i) => (
                    <MiniHBar
                      key={`${r.labelAr}-${i}`}
                      label={isAr ? r.labelAr : r.labelEn}
                      value={r.studentCount}
                      max={horizMax}
                      isAr={isAr}
                    />
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
                <h3 className="text-sm font-black text-slate-900">
                  {isAr ? "ميداليات ومراكز حسب الجنس" : "Medals & ranks by gender"}
                </h3>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[360px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-600">
                        <th className="py-2 pe-3">{isAr ? "الجنس" : "Gender"}</th>
                        <th className="py-2 pe-3">🥇</th>
                        <th className="py-2 pe-3">🥈</th>
                        <th className="py-2 pe-3">🥉</th>
                        <th className="py-2">{isAr ? "مراكز" : "Ranks"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.charts.genderResultStack.map((r) => (
                        <tr key={r.gender} className="border-b border-slate-100">
                          <td className="py-2 pe-3 font-semibold">{isAr ? r.labelAr : r.labelEn}</td>
                          <td className="py-2 pe-3 tabular-nums">{r.gold}</td>
                          <td className="py-2 pe-3 tabular-nums">{r.silver}</td>
                          <td className="py-2 pe-3 tabular-nums">{r.bronze}</td>
                          <td className="py-2 tabular-nums">{r.ranks}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:border-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-black text-slate-900">{isAr ? "الجدول التحليلي" : "Analytics table"}</h3>
                <p className="text-xs text-slate-500">
                  {isAr ? `صفحة ${page} من ${totalPages}` : `Page ${page} of ${totalPages}`}
                </p>
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[960px] border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                      {headers.map((h) => (
                        <th key={h} className="whitespace-nowrap px-2 py-2 font-bold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.table.length === 0 ? (
                      <tr>
                        <td colSpan={headers.length} className="px-2 py-8 text-center text-slate-500">
                          {isAr ? "لا توجد بيانات ضمن الفلاتر الحالية." : "No data for the current filters."}
                        </td>
                      </tr>
                    ) : (
                      data.table.map((r) => (
                        <tr key={r.activityKey} className="border-b border-slate-100 hover:bg-slate-50/80">
                          <td className="max-w-[200px] px-2 py-2 font-semibold text-slate-900">
                            {isAr ? r.activityLabelAr : r.activityLabelEn}
                          </td>
                          <td className="px-2 py-2">{isAr ? r.typeLabelAr : r.typeLabelEn}</td>
                          <td className="px-2 py-2">{isAr ? r.levelLabelAr : r.levelLabelEn}</td>
                          <td className="max-w-[180px] px-2 py-2">
                            {isAr ? r.participationResultAr : r.participationResultEn}
                          </td>
                          <td className="px-2 py-2 tabular-nums">{r.distinctParticipants}</td>
                          <td className="px-2 py-2 tabular-nums">{r.maleParticipants}</td>
                          <td className="px-2 py-2 tabular-nums">{r.femaleParticipants}</td>
                          <td className="px-2 py-2 tabular-nums">{r.arabicParticipants}</td>
                          <td className="px-2 py-2 tabular-nums">{r.internationalParticipants}</td>
                          <td className="px-2 py-2 tabular-nums">{r.mawhibaParticipants}</td>
                          <td className="px-2 py-2 tabular-nums">{r.nonMawhibaParticipants}</td>
                          <td className="px-2 py-2 tabular-nums">{r.excellenceRatePct}%</td>
                          <td className="px-2 py-2 tabular-nums">{r.approvedAchievements}</td>
                          <td className="px-2 py-2 tabular-nums">{r.totalParticipations}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold disabled:opacity-40"
                >
                  {isAr ? "السابق" : "Prev"}
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold disabled:opacity-40"
                >
                  {isAr ? "التالي" : "Next"}
                </button>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </PageContainer>
  );
};

export default AdminParticipationAnalyticsPage;
