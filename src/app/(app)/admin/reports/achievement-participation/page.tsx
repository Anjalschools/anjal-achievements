"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
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
  barClassName,
  barStyle,
}: {
  label: string;
  value: number;
  max: number;
  isAr: boolean;
  barClassName?: string;
  barStyle?: CSSProperties;
}) => {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px] font-bold text-slate-600">
        <span className="truncate">{label}</span>
        <span className="tabular-nums text-slate-900">{value}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100" dir={isAr ? "rtl" : "ltr"}>
        <div
          className={barClassName ?? "h-full rounded-full bg-primary transition-[width]"}
          style={{ width: `${pct}%`, ...barStyle }}
        />
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
    primaryType: "all",
    focusType: "",
    focusRaw: "",
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
    if (f.primaryType && f.primaryType !== "all") sp.set("primaryType", f.primaryType);
    if (f.focusType) {
      sp.set("focusType", f.focusType);
      sp.set("focusRaw", f.focusRaw);
    }
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
            "اسم النشاط",
            "النوع الرئيسي",
            "التصنيف الفرعي",
            "المستوى",
            "النتيجة",
            "مشاركون فريدون",
            "بنين",
            "بنات",
            "عربي",
            "دولي",
            "موهبة",
            "غير موهبة",
            "ذهبية",
            "فضية",
            "برونزية",
            "مراكز",
            "ترشيحات",
            "مشاركة فقط",
            "نسبة التميز %",
            "معتمد",
            "إجمالي السجلات",
          ]
        : [
            "Activity name",
            "Primary type",
            "Sub-classification",
            "Level",
            "Result",
            "Distinct participants",
            "Boys",
            "Girls",
            "Arabic",
            "International",
            "Mawhiba",
            "Non‑Mawhiba",
            "Gold",
            "Silver",
            "Bronze",
            "Ranks",
            "Nominations",
            "Participation only",
            "Excellence rate %",
            "Approved",
            "Total records",
          ],
    [isAr]
  );

  const tableRows = useMemo(() => {
    if (!data?.table) return [];
    return data.table.map((r: ParticipationActivityRow) => {
      const base = isAr
        ? {
            "اسم النشاط": r.activityLabelAr,
            "النوع الرئيسي": r.typeLabelAr,
            "التصنيف الفرعي": r.classificationLabelAr,
            المستوى: r.levelLabelAr,
            النتيجة: r.participationResultAr,
            "مشاركون فريدون": r.distinctParticipants,
            بنين: r.maleParticipants,
            بنات: r.femaleParticipants,
            عربي: r.arabicParticipants,
            دولي: r.internationalParticipants,
            موهبة: r.mawhibaParticipants,
            "غير موهبة": r.nonMawhibaParticipants,
            ذهبية: r.goldMedalCount,
            فضية: r.silverMedalCount,
            برونزية: r.bronzeMedalCount,
            مراكز: r.rankCount,
            ترشيحات: r.nominationCount,
            "مشاركة فقط": r.participationOnlyCount,
            "نسبة التميز %": r.excellenceRatePct,
            معتمد: r.approvedAchievements,
            "إجمالي السجلات": r.totalParticipations,
          }
        : {
            "Activity name": r.activityLabelEn,
            "Primary type": r.typeLabelEn,
            "Sub-classification": r.classificationLabelEn,
            Level: r.levelLabelEn,
            Result: r.participationResultEn,
            "Distinct participants": r.distinctParticipants,
            Boys: r.maleParticipants,
            Girls: r.femaleParticipants,
            Arabic: r.arabicParticipants,
            International: r.internationalParticipants,
            Mawhiba: r.mawhibaParticipants,
            "Non‑Mawhiba": r.nonMawhibaParticipants,
            Gold: r.goldMedalCount,
            Silver: r.silverMedalCount,
            Bronze: r.bronzeMedalCount,
            Ranks: r.rankCount,
            Nominations: r.nominationCount,
            "Participation only": r.participationOnlyCount,
            "Excellence rate %": r.excellenceRatePct,
            Approved: r.approvedAchievements,
            "Total records": r.totalParticipations,
          };
      return base as unknown as Record<string, string | number>;
    });
  }, [data, isAr]);

  const kpi = data?.kpis;

  const summaryLines = useMemo(() => {
    if (!kpi) return [];
    const lines = isAr
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
          `أنشطة في الجدول: ${kpi.activeProgramsCount}`,
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
          `Rows in table: ${kpi.activeProgramsCount}`,
        ];
    if (data?.focusedActivity) {
      lines.unshift(
        isAr
          ? `نطاق التحليل: نشاط واحد — ${data.focusedActivity.labelAr}`
          : `Analytics scope: single activity — ${data.focusedActivity.labelEn}`
      );
    }
    return lines;
  }, [kpi, isAr, data?.focusedActivity]);

  const reportTitle = useMemo(() => {
    if (!data?.focusedActivity) return title;
    return isAr ? `${title} — ${data.focusedActivity.labelAr}` : `${title} — ${data.focusedActivity.labelEn}`;
  }, [data?.focusedActivity, isAr, title]);

  const handleExcel = () =>
    void exportRowsToExcelWorkbook(tableRows, headers, reportTitle, "participation-analytics", { rtlSheet: isAr });

  const handlePdf = () => {
    const esc = (t: string) =>
      t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    let blocks = "";
    if (data?.charts?.resultOutcomeCompare?.length) {
      blocks += `<div style="margin-bottom:14px;font-size:11px"><strong>${esc(isAr ? "مقارنة النتائج (نطاق الفلاتر)" : "Result comparison (filter scope)")}</strong><table style="width:100%;margin-top:6px;border-collapse:collapse"><tr>`;
      blocks += data.charts.resultOutcomeCompare
        .map(
          (r) =>
            `<td style="border:1px solid #cbd5e1;padding:4px;text-align:right">${esc(isAr ? r.labelAr : r.labelEn)}: ${r.count}</td>`
        )
        .join("");
      blocks += `</tr></table></div>`;
    }
    if (data?.charts?.yearTrend?.length) {
      blocks += `<div style="margin-bottom:14px;font-size:11px"><strong>${esc(isAr ? "تطور السنوات" : "Year-over-year")}</strong><table style="width:100%;margin-top:6px;border-collapse:collapse">`;
      for (const y of data.charts.yearTrend) {
        blocks += `<tr><td style="border:1px solid #cbd5e1;padding:4px">${y.year}</td><td style="border:1px solid #cbd5e1;padding:4px">${esc(isAr ? "سجلات" : "Records")}: ${y.totalRows}</td><td style="border:1px solid #cbd5e1;padding:4px">${esc(isAr ? "طلاب" : "Students")}: ${y.distinctStudents}</td><td style="border:1px solid #cbd5e1;padding:4px">Gold: ${y.goldMedals}</td></tr>`;
      }
      blocks += `</table></div>`;
    }
    void exportLandscapeExecutivePdfView(summaryLines, tableRows, headers, reportTitle, "/report-header.png", {
      subtitle: data?.focusedActivity
        ? isAr
          ? data.focusedActivity.labelAr
          : data.focusedActivity.labelEn
        : undefined,
      blocksHtml: blocks || undefined,
    });
  };

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
  const resultCompareMax = useMemo(
    () => Math.max(1, ...(data?.charts.resultOutcomeCompare.map((x) => x.count) || [0])),
    [data]
  );
  const yearTrendMax = useMemo(
    () => Math.max(1, ...(data?.charts.yearTrend.map((x) => x.totalRows) || [0])),
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
              ? "تحليل فعلي لكل نشاط مسجّل (مسابقة، برنامج، اختبار…) مع فلاتر ذكية، رسوم مقارنة، وتصدير تنفيذي."
              : "Concrete activities as recorded (competition, program, test, …) with smart filters, comparison charts, and executive export."
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
          <p className="mt-1 text-xs text-slate-500">
            {isAr
              ? "اختر نوع النشاط ثم الاسم الفعلي المسجّل (كانجارو، SAT، برنامج إثرائي…). التحليل والتصدير يتبعان النطاق الحالي."
              : "Pick a primary type, then the concrete name as recorded (Kangaroo, SAT, enrichment program, …). Analytics and export follow the current scope."}
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col text-xs font-semibold text-slate-600 lg:col-span-2">
              {isAr ? "نوع النشاط (رئيسي)" : "Primary activity type"}
              <select
                value={f.primaryType}
                onChange={(e) => {
                  setPage(1);
                  setF((p) => ({
                    ...p,
                    primaryType: e.target.value,
                    focusType: "",
                    focusRaw: "",
                  }));
                }}
                className="mt-1 rounded-lg border border-slate-200 px-2 py-2 text-sm"
                aria-label={isAr ? "نوع النشاط" : "Primary activity type"}
              >
                <option value="all">{isAr ? "الكل" : "All"}</option>
                {categoryOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-xs font-semibold text-slate-600 lg:col-span-2">
              {isAr ? "اسم النشاط (المسابقة / البرنامج / الاختبار)" : "Activity name (competition / program / test)"}
              <select
                value={f.focusType ? `${f.focusType}\u001f${f.focusRaw}` : ""}
                onChange={(e) => {
                  setPage(1);
                  const v = e.target.value;
                  if (!v) {
                    setF((p) => ({ ...p, focusType: "", focusRaw: "" }));
                    return;
                  }
                  const idx = v.indexOf("\u001f");
                  const tk = idx === -1 ? v : v.slice(0, idx);
                  const rk = idx === -1 ? "" : v.slice(idx + 1);
                  setF((p) => ({ ...p, focusType: tk, focusRaw: rk }));
                }}
                className="mt-1 rounded-lg border border-slate-200 px-2 py-2 text-sm"
                aria-label={isAr ? "اسم النشاط" : "Activity name"}
              >
                <option value="">{isAr ? "— كل الأنشطة —" : "— All activities —"}</option>
                {(data?.activityOptions ?? [])
                  .filter((o) => f.primaryType === "all" || o.typeKey === f.primaryType)
                  .map((o) => (
                    <option key={`${o.typeKey}\u001f${o.rawKey}`} value={`${o.typeKey}\u001f${o.rawKey}`}>
                      {(isAr ? o.labelAr : o.labelEn) + ` · ${o.count}`}
                    </option>
                  ))}
              </select>
            </label>
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

        {data?.focusedActivity ? (
          <div
            className="mb-4 rounded-2xl border-2 border-indigo-200 bg-indigo-50/90 px-4 py-3 text-sm font-bold text-indigo-950 shadow-sm print:border print:bg-white"
            role="status"
          >
            {isAr ? "تقرير مركّز على نشاط واحد:" : "Focused single-activity report:"}{" "}
            <span dir="auto">{isAr ? data.focusedActivity.labelAr : data.focusedActivity.labelEn}</span>
          </div>
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
              <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/80 p-4 shadow-sm">
                <h3 className="text-sm font-black text-slate-900">
                  {isAr ? "مقارنة النتائج (نطاق الفلاتر)" : "Result comparison (filtered scope)"}
                </h3>
                <p className="mt-1 text-[11px] text-slate-500">
                  {isAr ? "ذهبية، فضية، برونزية، ترشيح، مراكز، مشاركة فقط" : "Gold, silver, bronze, nomination, ranks, participation"}
                </p>
                <div className="mt-3 space-y-2">
                  {data.charts.resultOutcomeCompare.map((r) => (
                    <MiniHBar
                      key={r.key}
                      label={isAr ? r.labelAr : r.labelEn}
                      value={r.count}
                      max={resultCompareMax}
                      isAr={isAr}
                      barClassName="h-full rounded-full transition-[width]"
                      barStyle={{ backgroundColor: r.color }}
                    />
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/80 p-4 shadow-sm">
                <h3 className="text-sm font-black text-slate-900">
                  {isAr ? "تطور السنوات" : "Year-over-year"}
                </h3>
                <p className="mt-1 text-[11px] text-slate-500">
                  {isAr
                    ? "حسب سنة الإنجاز أو تاريخ السجل عند غياب السنة"
                    : "By achievement year or record date when year is missing"}
                </p>
                <div className="mt-3 space-y-2">
                  {data.charts.yearTrend.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      {isAr ? "لا تتوفر بيانات سنوات كافية ضمن الفلاتر." : "Not enough year data under current filters."}
                    </p>
                  ) : (
                    data.charts.yearTrend.map((y) => (
                      <MiniHBar
                        key={y.year}
                        label={`${y.year} · ${isAr ? "سجلات" : "rows"} ${y.totalRows} · ${isAr ? "طلاب" : "students"} ${y.distinctStudents} · 🥇 ${y.goldMedals}`}
                        value={y.totalRows}
                        max={yearTrendMax}
                        isAr={isAr}
                        barClassName="h-full rounded-full bg-teal-600 transition-[width]"
                      />
                    ))
                  )}
                </div>
              </div>
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
                <table className="w-full min-w-[1280px] border-collapse text-left text-xs">
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
                          <td className="max-w-[220px] px-2 py-2 font-semibold text-slate-900">
                            {isAr ? r.activityLabelAr : r.activityLabelEn}
                          </td>
                          <td className="px-2 py-2">{isAr ? r.typeLabelAr : r.typeLabelEn}</td>
                          <td className="max-w-[120px] px-2 py-2 text-slate-700">
                            {isAr ? r.classificationLabelAr : r.classificationLabelEn}
                          </td>
                          <td className="px-2 py-2">{isAr ? r.levelLabelAr : r.levelLabelEn}</td>
                          <td className="max-w-[160px] px-2 py-2">
                            {isAr ? r.participationResultAr : r.participationResultEn}
                          </td>
                          <td className="px-2 py-2 tabular-nums">{r.distinctParticipants}</td>
                          <td className="px-2 py-2 tabular-nums">{r.maleParticipants}</td>
                          <td className="px-2 py-2 tabular-nums">{r.femaleParticipants}</td>
                          <td className="px-2 py-2 tabular-nums">{r.arabicParticipants}</td>
                          <td className="px-2 py-2 tabular-nums">{r.internationalParticipants}</td>
                          <td className="px-2 py-2 tabular-nums">{r.mawhibaParticipants}</td>
                          <td className="px-2 py-2 tabular-nums">{r.nonMawhibaParticipants}</td>
                          <td className="px-2 py-2 tabular-nums text-amber-800">{r.goldMedalCount}</td>
                          <td className="px-2 py-2 tabular-nums text-slate-600">{r.silverMedalCount}</td>
                          <td className="px-2 py-2 tabular-nums text-amber-950/80">{r.bronzeMedalCount}</td>
                          <td className="px-2 py-2 tabular-nums">{r.rankCount}</td>
                          <td className="px-2 py-2 tabular-nums">{r.nominationCount}</td>
                          <td className="px-2 py-2 tabular-nums">{r.participationOnlyCount}</td>
                          <td className="px-2 py-2 tabular-nums">{r.excellenceRatePct}%</td>
                          <td className="px-2 py-2 tabular-nums">{r.approvedAchievements}</td>
                          <td className="px-2 py-2 tabular-nums font-semibold">{r.totalParticipations}</td>
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
