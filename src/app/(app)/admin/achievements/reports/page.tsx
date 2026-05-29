"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import { getLocale } from "@/lib/i18n";
import { getGradeLabel } from "@/constants/grades";
import { exportRowsToExcelWorkbook, exportRowsToPrintablePdfView } from "@/lib/report-export";
import { getAchievementReportTitle } from "@/lib/report-title";
import { reportStageLabel } from "@/lib/report-stage-mapping";
import {
  normalizeAchievementReportData,
  reportLevelBadgeClass,
  reportStatusBadgeClass,
} from "@/lib/achievement-report-normalize";
import { Loader2, RefreshCw } from "lucide-react";
import MultiSelect from "@/components/ui/multi-select";
import CanonicalActivityCombobox from "@/components/reports/CanonicalActivityCombobox";
import ActivityYearCombobox from "@/components/reports/ActivityYearCombobox";
import {
  buildAdminReportSearchParams,
  buildReportOptionFetchParams,
  defaultReportFilterUiState,
  type ReportFilterUiState,
} from "@/lib/analytics/report-filter-params";
import { useAnalyticsUrlSync } from "@/hooks/useAnalyticsUrlSync";
import type { AnalyticsUrlUiState } from "@/lib/analytics/report-filter-url-sync";
import {
  getReportCategoryOptions,
  getReportLevelOptions,
  getReportResultOptions,
  getStandardizedTestTypeOptions,
  getReportGenderOptions,
  getReportMawhibaOptions,
  getReportStageOptions,
  getReportGradeOptions,
  getReportStatusOptions,
  getReportCertificateStatusOptions,
} from "@/lib/report-filter-options";

type AdminReportRow = {
  id: string;
  studentId: string;
  studentName: string;
  gender: string;
  grade: string;
  stage: "primary" | "middle" | "secondary" | "unknown";
  stageLabelAr: string;
  stageLabelEn: string;
  categoryLabelAr: string;
  categoryLabelEn: string;
  eventLabelAr: string;
  eventLabelEn: string;
  analyticsActivityKey?: string;
  analyticsActivityDisplayAr?: string;
  analyticsActivityDisplayEn?: string;
  activityYearLabelAr?: string;
  activityYearLabelEn?: string;
  activityYear?: number | null;
  standardizedTestType?: string | null;
  levelLabelAr: string;
  levelLabelEn: string;
  participationLabelAr: string;
  participationLabelEn: string;
  resultLabelAr: string;
  resultLabelEn: string;
  year: number | null;
  dateIso: string | null;
  dateLabelAr: string;
  status: string;
  certificateIssued: boolean;
  description: string;
  isMawhibaStudent?: boolean;
};

type UnifiedPayload = {
  rows: AdminReportRow[];
  stats: Record<string, unknown>;
  admin: Record<string, unknown>;
};

const AdminAchievementReportsPageInner = () => {
  const router = useRouter();
  const locale = getLocale();
  const isAr = locale === "ar";
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [rows, setRows] = useState<AdminReportRow[]>([]);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [adminStats, setAdminStats] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState<ReportFilterUiState>(() => defaultReportFilterUiState());
  const deferredF = useDeferredValue(f);
  const urlHydrationDoneRef = useRef(false);

  const handleHydrateFromUrl = useCallback(
    ({
      filters,
      hasUrlFilters,
    }: {
      filters: ReportFilterUiState;
      ui: AnalyticsUrlUiState;
      hasUrlFilters: boolean;
    }) => {
      if (hasUrlFilters) setF(filters);
    },
    []
  );

  const { copyShareUrl } = useAnalyticsUrlSync({
    scope: "reports",
    filter: f,
    onHydrateFromUrl: handleHydrateFromUrl,
    hydrationDoneRef: urlHydrationDoneRef,
  });

  const categoryOptions = useMemo(
    () => getReportCategoryOptions(isAr ? "ar" : "en"),
    [isAr]
  );
  const levelOptions = useMemo(() => getReportLevelOptions(isAr ? "ar" : "en"), [isAr]);
  const resultOptions = useMemo(() => getReportResultOptions(isAr ? "ar" : "en"), [isAr]);
  const genderOptions = useMemo(() => getReportGenderOptions(isAr ? "ar" : "en"), [isAr]);
  const mawhibaOptions = useMemo(() => getReportMawhibaOptions(isAr ? "ar" : "en"), [isAr]);
  const stageOptions = useMemo(() => getReportStageOptions(isAr ? "ar" : "en"), [isAr]);
  const gradeOptions = useMemo(() => getReportGradeOptions(isAr ? "ar" : "en"), [isAr]);
  const statusOptions = useMemo(() => getReportStatusOptions(isAr ? "ar" : "en"), [isAr]);
  const certificateOptions = useMemo(() => getReportCertificateStatusOptions(isAr ? "ar" : "en"), [isAr]);
  const stdTestOptions = useMemo(() => getStandardizedTestTypeOptions(isAr ? "ar" : "en"), [isAr]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/user/profile", { cache: "no-store" });
        if (!res.ok) {
          setAllowed(false);
          return;
        }
        const data = await res.json();
        const role = String(data.role || "");
        setAllowed(
          ["admin", "supervisor", "schoolAdmin", "teacher", "judge"].includes(role)
        );
      } catch {
        setAllowed(false);
      }
    })();
  }, []);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = buildAdminReportSearchParams(deferredF as unknown as Record<string, unknown>);
      const res = await fetch(`/api/admin/achievements/reports?${params.toString()}`, { cache: "no-store" });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (res.status === 403) {
        setAllowed(false);
        return;
      }
      const j = (await res.json().catch(() => ({}))) as UnifiedPayload & { error?: string };
      if (!res.ok) {
        throw new Error(typeof j.error === "string" ? j.error : "Request failed");
      }
      setRows(Array.isArray(j.rows) ? j.rows : []);
      setStats(j.stats || null);
      setAdminStats(j.admin || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setRows([]);
      setStats(null);
      setAdminStats(null);
    } finally {
      setLoading(false);
    }
  }, [deferredF, router]);

  useEffect(() => {
    if (allowed !== true) return;
    void fetchReport();
  }, [allowed, fetchReport]);

  const activityFetchParams = useMemo(() => {
    const base = buildReportOptionFetchParams(deferredF as unknown as Record<string, unknown>);
    delete base.achievementNames;
    return base;
  }, [deferredF]);

  const yearFetchParams = useMemo(() => {
    const base = buildReportOptionFetchParams(deferredF as unknown as Record<string, unknown>);
    delete base.activityYears;
    delete base.filterActivityYear;
    return base;
  }, [deferredF]);

  const selectedActivityLabels = useMemo(() => {
    if (f.achievementNames.length === 0) return undefined;
    const fromRows = f.achievementNames.map((key) => {
      const hit = rows.find((r) => r.analyticsActivityKey === key);
      return hit?.analyticsActivityDisplayAr || hit?.eventLabelAr || key.replace(/_/g, " ");
    });
    return fromRows.join(isAr ? "، " : ", ");
  }, [f.achievementNames, rows, isAr]);

  const reportTitle = useMemo(() => {
    const joinLabels = (values: string[], options: Array<{ value: string; label: string }>) => {
      if (values.length === 0) return undefined;
      const map = new Map(options.map((o) => [o.value, o.label]));
      return values.map((v) => map.get(v) || v).join(isAr ? "، " : ", ");
    };
    return getAchievementReportTitle(
      {
        academicYear: f.academicYear,
        genderLabels: joinLabels(f.genders, genderOptions),
        stageLabels: joinLabels(f.stages, stageOptions),
        gradeLabels: joinLabels(f.grades, gradeOptions),
        eventLabels: selectedActivityLabels,
        activityYearLabels:
          f.activityYears.length > 0
            ? f.activityYears.map((y) => `${y}م`).join(isAr ? "، " : ", ")
            : undefined,
        levelLabels: joinLabels(f.levels, levelOptions),
        resultLabels: joinLabels(f.resultTokens, resultOptions),
      },
      true
    );
  }, [f, selectedActivityLabels, genderOptions, stageOptions, gradeOptions, levelOptions, resultOptions, isAr]);

  const tableHeaders = [
    "اسم الطالب",
    "الصف",
    "المرحلة",
    "تصنيف الإنجاز",
    "اسم الإنجاز",
    "سنة النشاط",
    "نوع الاختبار",
    "النتيجة",
    "المستوى",
    "المشاركة",
    "السنة",
    "التاريخ",
    "الحالة",
    "حالة الشهادة",
  ];
  const normalizedRows = useMemo(
    () =>
      normalizeAchievementReportData(
        rows.map((r) => ({
          ...r,
          grade: getGradeLabel(r.grade, "ar"),
          analyticsActivityDisplayAr:
            r.analyticsActivityDisplayAr || r.eventLabelAr,
          activityYear: r.activityYear ?? r.year,
          activityYearLabelAr: r.activityYearLabelAr,
          standardizedTestType: r.standardizedTestType,
          resultLabelAr: r.resultLabelAr,
        }))
      ),
    [rows]
  );
  const tableRows: Array<Record<string, string | number>> = normalizedRows.map((r) => ({
    "اسم الطالب": r.studentName,
    الصف: r.grade,
    المرحلة: r.stage,
    "تصنيف الإنجاز": r.achievementType,
    "اسم الإنجاز": r.achievementName,
    "سنة النشاط": r.activityYear,
    "نوع الاختبار": r.testTypeLabel,
    النتيجة: r.result,
    المستوى: r.level,
    المشاركة: r.participation,
    السنة: r.year,
    التاريخ: r.date,
    الحالة: r.statusLabel,
    "حالة الشهادة": r.certificateStatusLabel,
  }));

  const handleExportExcel = () =>
    exportRowsToExcelWorkbook(tableRows, tableHeaders, reportTitle, "achievement-report");

  const handleExportPdf = () =>
    exportRowsToPrintablePdfView(tableRows, tableHeaders, reportTitle, "/report-header.png");

  const statusCounts = (adminStats?.statusCounts || {}) as Record<string, number>;

  if (allowed === false) {
    return (
      <PageContainer>
        <p className="p-6 text-sm text-red-700">
          {isAr ? "غير مصرح لك بعرض هذه الصفحة." : "You are not allowed to view this page."}
        </p>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div dir={isAr ? "rtl" : "ltr"}>
        <PageHeader
          title={isAr ? "تقارير الإنجازات" : "Achievement reports"}
          subtitle={
            isAr
              ? "تقارير جدولية وإحصائية وإدارية شاملة لإنجازات الطلبة"
              : "Comprehensive tabular, statistical, and admin achievement reports"
          }
          actions={
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void fetchReport()}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-text shadow-sm hover:bg-gray-50"
              >
                <RefreshCw className="h-4 w-4" />
                {isAr ? "تحديث" : "Refresh"}
              </button>
              <button
                type="button"
                onClick={handleExportPdf}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-text shadow-sm hover:bg-gray-50"
              >
                PDF
              </button>
              <button
                type="button"
                onClick={handleExportExcel}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-text shadow-sm hover:bg-gray-50"
              >
                Excel
              </button>
              <button
                type="button"
                onClick={() => {
                  const url = copyShareUrl();
                  if (url) void navigator.clipboard?.writeText(url);
                }}
                className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-900 shadow-sm hover:bg-indigo-100"
              >
                {isAr ? "نسخ الرابط" : "Copy link"}
              </button>
              <button
                type="button"
                onClick={() => setF(defaultReportFilterUiState())}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-text shadow-sm hover:bg-gray-50"
              >
                {isAr ? "إعادة تعيين الفلاتر" : "Reset filters"}
              </button>
            </div>
          }
        />
        <Link
          href="/admin/reports/achievement-participation"
          className="mb-2 inline-block text-sm font-semibold text-primary hover:underline"
        >
          {isAr ? "→ إحصائيات المشاركات والإنجازات (تحليلي)" : "→ Participation & achievements analytics"}
        </Link>
        <Link
          href="/admin/achievements/review"
          className="mb-4 inline-block text-sm font-semibold text-primary hover:underline"
        >
          {isAr ? "← العودة لمراجعة الإنجازات" : "← Back to achievement review"}
        </Link>

        <div className="mb-6 grid gap-3 rounded-2xl border border-gray-200 bg-white p-4 md:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col text-xs font-semibold text-text-light">
            {isAr ? "العام الدراسي" : "Academic year"}
            <select
              value={f.academicYear}
              onChange={(e) => setF((p) => ({ ...p, academicYear: e.target.value }))}
              className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-text"
            >
              <option value="2025-2026م">2025-2026م</option>
            </select>
          </label>
          <div className="flex flex-col text-xs font-semibold text-text-light">
            <ActivityYearCombobox
              label={isAr ? "سنة النشاط" : "Activity year"}
              value={f.activityYears}
              onChange={(years) => setF((p) => ({ ...p, activityYears: years }))}
              fetchParams={yearFetchParams}
              isAr={isAr}
              className="mt-1"
            />
          </div>
          <div className="flex flex-col text-xs font-semibold text-text-light">
            <MultiSelect
              label={isAr ? "النوع" : "Gender"}
              placeholder={isAr ? "اختر النوع" : "Select gender"}
              options={genderOptions}
              value={f.genders}
              onChange={(next) => setF((p) => ({ ...p, genders: next }))}
              isRtl={isAr}
              searchable
              maxVisibleChips={2}
              selectAllLabel={isAr ? "الكل" : "All"}
              clearLabel={isAr ? "مسح التحديد" : "Clear selection"}
              className="mt-1"
            />
          </div>
          <div className="flex flex-col text-xs font-semibold text-text-light">
            <MultiSelect
              label={isAr ? "فصول موهبة" : "Mawhiba classes"}
              placeholder={isAr ? "اختر فئة موهبة" : "Select Mawhiba filter"}
              options={mawhibaOptions}
              value={f.mawhibaValues}
              onChange={(next) => setF((p) => ({ ...p, mawhibaValues: next }))}
              isRtl={isAr}
              searchable
              maxVisibleChips={2}
              selectAllLabel={isAr ? "الكل" : "All"}
              clearLabel={isAr ? "مسح التحديد" : "Clear selection"}
              className="mt-1"
            />
          </div>
          <div className="flex flex-col text-xs font-semibold text-text-light">
            <MultiSelect
              label={isAr ? "المرحلة" : "Stage"}
              placeholder={isAr ? "اختر المرحلة" : "Select stage"}
              options={stageOptions}
              value={f.stages}
              onChange={(next) => setF((p) => ({ ...p, stages: next }))}
              isRtl={isAr}
              searchable
              maxVisibleChips={2}
              selectAllLabel={isAr ? "الكل" : "All"}
              clearLabel={isAr ? "مسح التحديد" : "Clear selection"}
              className="mt-1"
            />
          </div>
          <div className="flex flex-col text-xs font-semibold text-text-light">
            <MultiSelect
              label={isAr ? "الصف" : "Grade"}
              placeholder={isAr ? "اختر الصف" : "Select grade"}
              options={gradeOptions}
              value={f.grades}
              onChange={(next) => setF((p) => ({ ...p, grades: next }))}
              isRtl={isAr}
              searchable
              maxVisibleChips={2}
              selectAllLabel={isAr ? "الكل" : "All"}
              clearLabel={isAr ? "مسح التحديد" : "Clear selection"}
              className="mt-1"
            />
          </div>
          <div className="flex flex-col text-xs font-semibold text-text-light">
            <MultiSelect
              label={isAr ? "تصنيف الإنجاز" : "Achievement category"}
              placeholder={isAr ? "اختر تصنيف الإنجاز" : "Select achievement category"}
              options={categoryOptions}
              value={f.categories}
              onChange={(next) => setF((p) => ({ ...p, categories: next }))}
              isRtl={isAr}
              searchable
              maxVisibleChips={2}
              selectAllLabel={isAr ? "الكل" : "All"}
              clearLabel={isAr ? "مسح التحديد" : "Clear selection"}
              className="mt-1"
            />
          </div>
          <div className="flex flex-col text-xs font-semibold text-text-light">
            <CanonicalActivityCombobox
              label={isAr ? "اسم الإنجاز" : "Achievement name"}
              value={f.achievementNames}
              onChange={(names) => setF((p) => ({ ...p, achievementNames: names }))}
              fetchParams={activityFetchParams}
              isAr={isAr}
              className="mt-1"
            />
          </div>
          <label className="flex items-center gap-2 self-end text-xs font-semibold text-text">
            <input
              type="checkbox"
              checked={f.uniqueParticipantsOnly}
              onChange={(e) => setF((p) => ({ ...p, uniqueParticipantsOnly: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/30"
            />
            {isAr ? "احتساب الطلاب الفريدين فقط" : "Unique participants only"}
          </label>
          <label className="flex flex-col text-xs font-semibold text-text-light">
            {isAr ? "الدرجة من" : "Score min"}
            <input
              type="number"
              value={f.scoreMin}
              onChange={(e) => setF((p) => ({ ...p, scoreMin: e.target.value }))}
              placeholder={isAr ? "مثال: 95" : "e.g. 95"}
              className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col text-xs font-semibold text-text-light">
            {isAr ? "الدرجة إلى" : "Score max"}
            <input
              type="number"
              value={f.scoreMax}
              onChange={(e) => setF((p) => ({ ...p, scoreMax: e.target.value }))}
              placeholder={isAr ? "مثال: 1600" : "e.g. 1600"}
              className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <div className="flex flex-col text-xs font-semibold text-text-light">
            <MultiSelect
              label={isAr ? "المستوى" : "Level"}
              placeholder={isAr ? "اختر المستوى" : "Select level"}
              options={levelOptions}
              value={f.levels}
              onChange={(next) => setF((p) => ({ ...p, levels: next }))}
              isRtl={isAr}
              searchable
              maxVisibleChips={2}
              selectAllLabel={isAr ? "الكل" : "All"}
              clearLabel={isAr ? "مسح التحديد" : "Clear selection"}
              className="mt-1"
            />
          </div>
          <div className="flex flex-col text-xs font-semibold text-text-light">
            <MultiSelect
              label={isAr ? "النتيجة" : "Result"}
              placeholder={isAr ? "اختر النتيجة" : "Select result"}
              options={resultOptions}
              value={f.resultTokens}
              onChange={(next) => setF((p) => ({ ...p, resultTokens: next }))}
              isRtl={isAr}
              searchable
              maxVisibleChips={2}
              selectAllLabel={isAr ? "الكل" : "All"}
              clearLabel={isAr ? "مسح التحديد" : "Clear selection"}
              className="mt-1"
            />
          </div>
          <div className="flex flex-col text-xs font-semibold text-text-light">
            <MultiSelect
              label={isAr ? "حالة الإنجاز" : "Status"}
              placeholder={isAr ? "اختر الحالة" : "Select status"}
              options={statusOptions}
              value={f.statuses}
              onChange={(next) => setF((p) => ({ ...p, statuses: next }))}
              isRtl={isAr}
              searchable
              maxVisibleChips={2}
              selectAllLabel={isAr ? "الكل" : "All"}
              clearLabel={isAr ? "مسح التحديد" : "Clear selection"}
              className="mt-1"
            />
          </div>
          <div className="flex flex-col text-xs font-semibold text-text-light">
            <MultiSelect
              label={isAr ? "حالة الشهادة" : "Certificate status"}
              placeholder={isAr ? "اختر حالة الشهادة" : "Select certificate status"}
              options={certificateOptions}
              value={f.certificateStatuses}
              onChange={(next) => setF((p) => ({ ...p, certificateStatuses: next }))}
              isRtl={isAr}
              searchable
              maxVisibleChips={2}
              selectAllLabel={isAr ? "الكل" : "All"}
              clearLabel={isAr ? "مسح التحديد" : "Clear selection"}
              className="mt-1"
            />
          </div>
          <div className="flex flex-col text-xs font-semibold text-text-light">
            <MultiSelect
              label={isAr ? "نوع الاختبار المعياري" : "Standardized test type"}
              placeholder={isAr ? "اختر نوع الاختبار" : "Select test type"}
              options={stdTestOptions}
              value={f.standardizedTestTypes}
              onChange={(next) => setF((p) => ({ ...p, standardizedTestTypes: next }))}
              isRtl={isAr}
              searchable
              maxVisibleChips={2}
              selectAllLabel={isAr ? "الكل" : "All"}
              clearLabel={isAr ? "مسح التحديد" : "Clear selection"}
              className="mt-1"
            />
          </div>
          <label className="flex flex-col text-xs font-semibold text-text-light">
            {isAr ? "من تاريخ" : "From date"}
            <input
              type="date"
              value={f.fromDate}
              onChange={(e) => setF((p) => ({ ...p, fromDate: e.target.value }))}
              className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col text-xs font-semibold text-text-light">
            {isAr ? "إلى تاريخ" : "To date"}
            <input
              type="date"
              value={f.toDate}
              onChange={(e) => setF((p) => ({ ...p, toDate: e.target.value }))}
              className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        {error ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <section className="mb-4 rounded-2xl border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-bold text-text">{reportTitle}</h3>
          <p className="mt-1 text-xs text-text-light">
            {isAr ? "عنوان التقرير يتغير تلقائيًا حسب الفلاتر الحالية." : "Title is generated from active filters."}
          </p>
        </section>

        {loading || allowed === null ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
          </div>
        ) : stats && adminStats ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard label={isAr ? "إجمالي السجلات" : "Total rows"} value={rows.length} />
              <MetricCard
                label={isAr ? "الطلاب المشاركون" : "Distinct students"}
                value={new Set(rows.map((r) => r.studentId || r.id)).size}
              />
              <MetricCard
                label={isAr ? "الشهادات الصادرة" : "Issued certificates"}
                value={rows.filter((r) => r.certificateIssued).length}
              />
              <MetricCard
                label={isAr ? "غير صادرة" : "Without certificate"}
                value={rows.filter((r) => !r.certificateIssued).length}
              />
              <MetricCard label={isAr ? "معتمد" : "Approved"} value={statusCounts.approved || 0} />
              <MetricCard label={isAr ? "تحت المراجعة" : "Under review"} value={statusCounts.pending || 0} />
            </div>

            {Array.isArray(stats?.standardizedTestStats) &&
            (stats.standardizedTestStats as Array<Record<string, unknown>>).length > 0 ? (
              <section className="rounded-2xl border border-violet-200 bg-violet-50/40 p-4">
                <h3 className="mb-3 text-sm font-bold text-text">
                  {isAr ? "إحصائيات الاختبارات المعيارية" : "Standardized test statistics"}
                </h3>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {(stats.standardizedTestStats as Array<Record<string, unknown>>).map((t, i) => (
                    <div key={i} className="rounded-lg border border-violet-100 bg-white p-3 text-xs">
                      <p className="font-bold text-text">{String(t.testType || "—")}</p>
                      <p className="mt-1 text-text-light">
                        {isAr ? "متوسط" : "Avg"}: {String(t.average ?? "—")} · {isAr ? "أعلى" : "Max"}:{" "}
                        {String(t.max ?? "—")}
                      </p>
                      <p className="text-text-light">
                        {isAr ? "سجلات" : "Rows"}: {String(t.count ?? 0)} · {isAr ? "طلاب" : "Students"}:{" "}
                        {String(t.studentCount ?? 0)}
                      </p>
                      {t.above95 != null ? (
                        <p className="text-text-light">
                          {isAr ? "فوق 95%" : "Above 95%"}: {String(t.above95)}
                        </p>
                      ) : null}
                      {t.above1400 != null ? (
                        <p className="text-text-light">SAT ≥ 1400: {String(t.above1400)}</p>
                      ) : null}
                      {t.above7 != null ? (
                        <p className="text-text-light">IELTS ≥ 7: {String(t.above7)}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {Array.isArray(stats?.yearOverYearByActivity) &&
            (stats.yearOverYearByActivity as Array<Record<string, unknown>>).length > 0 ? (
              <section className="rounded-2xl border border-gray-200 bg-white p-4">
                <h3 className="mb-3 text-sm font-bold text-text">
                  {isAr ? "تحليل سنوي للأنشطة (Year-over-Year)" : "Year-over-year activity trends"}
                </h3>
                <div className="grid gap-2 lg:grid-cols-2">
                  {(stats.yearOverYearByActivity as Array<Record<string, unknown>>)
                    .slice(0, 8)
                    .map((item, i) => (
                      <div key={i} className="rounded-lg border border-gray-100 bg-gray-50/70 p-3 text-xs">
                        <p className="font-bold text-text">
                          {String(isAr ? item.labelAr : item.labelEn || item.labelAr)}
                        </p>
                        <p className="mt-1 text-text-light">
                          {(item.years as Array<{ year: number; rowsCount: number }> | undefined)
                            ?.map((y) => `${y.year}: ${y.rowsCount}`)
                            .join(" · ") || "—"}
                        </p>
                        {item.growthPct != null ? (
                          <p className="mt-1 font-semibold text-primary">
                            {isAr ? "النمو" : "Growth"}: {String(item.growthPct)}%
                          </p>
                        ) : null}
                      </div>
                    ))}
                </div>
              </section>
            ) : null}

            {Array.isArray(stats?.byActivityYear) &&
            (stats.byActivityYear as Array<Record<string, unknown>>).length > 0 ? (
              <section className="rounded-2xl border border-emerald-200 bg-emerald-50/30 p-4">
                <h3 className="mb-3 text-sm font-bold text-text">
                  {isAr ? "توزيع حسب سنة النشاط" : "Distribution by activity year"}
                </h3>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {(stats.byActivityYear as Array<Record<string, unknown>>).map((y, i) => (
                    <div key={i} className="rounded-lg border border-emerald-100 bg-white p-3 text-xs">
                      <p className="font-bold text-text">{String(y.labelAr || y.year)}</p>
                      <p className="mt-1 text-text-light">
                        {isAr ? "سجلات" : "Rows"}: {String(y.rowsCount ?? 0)} · {isAr ? "طلاب" : "Students"}:{" "}
                        {String(y.studentCount ?? 0)}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="rounded-2xl border border-gray-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-bold text-text">
                {isAr ? "تقرير إنجازات الطلبة (جدولي)" : "Students achievement report table"}
              </h3>
              <div className="overflow-x-auto rounded-lg border border-gray-100">
                <table className="min-w-[1320px] text-sm">
                  <thead className="bg-gray-50 text-text">
                    <tr>
                      {tableHeaders.map((h) => (
                        <th key={h} className="px-2 py-2 text-start text-xs font-bold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.length === 0 ? (
                      <tr>
                        <td colSpan={tableHeaders.length} className="px-3 py-8 text-center text-text-light">
                          {isAr ? "لا توجد بيانات مطابقة للفلاتر." : "No rows match selected filters."}
                        </td>
                      </tr>
                    ) : (
                      normalizedRows.map((row, i) => (
                        <tr key={i} className="border-t border-gray-100 align-top odd:bg-white even:bg-gray-50/40 hover:bg-primary/5">
                          <td className="px-2 py-2 text-xs font-semibold text-text">{row.studentName}</td>
                          <td className="px-2 py-2 text-xs text-text">{row.grade}</td>
                          <td className="px-2 py-2 text-xs text-text">{row.stage}</td>
                          <td className="px-2 py-2 text-xs text-text">{row.achievementType}</td>
                          <td className="px-2 py-2 text-xs text-text">{row.achievementName}</td>
                          <td className="px-2 py-2 text-xs text-text">{row.activityYear}</td>
                          <td className="px-2 py-2 text-xs text-text">{row.testTypeLabel}</td>
                          <td className="px-2 py-2 text-xs font-semibold text-text">{row.result}</td>
                          <td className="px-2 py-2 text-xs">
                            <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ring-1 ${reportLevelBadgeClass(row.level)}`}>
                              {row.level}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-xs text-text">{row.participation}</td>
                          <td className="px-2 py-2 text-xs text-text">{row.year}</td>
                          <td className="px-2 py-2 text-xs text-text">{row.date}</td>
                          <td className="px-2 py-2 text-xs">
                            <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ring-1 ${reportStatusBadgeClass(
                              row.statusKey
                            )}`}>
                              {row.statusLabel}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-xs">
                            <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ring-1 ${row.certificateStatusLabel === "صادرة" ? "bg-blue-100 text-blue-900 ring-blue-200" : "bg-slate-100 text-slate-800 ring-slate-200"}`}>
                              {row.certificateStatusLabel}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <StatsPanel isAr={isAr} stats={stats} />
              <TopStudentsPanel isAr={isAr} adminStats={adminStats} />
            </section>
          </div>
        ) : (
          <p className="text-sm text-text-light">
            {isAr ? "أدخل المعاملات المطلوبة ثم يُحمّل التقرير." : "Enter required parameters to load the report."}
          </p>
        )}
      </div>
    </PageContainer>
  );
};

const MetricCard = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
    <p className="text-xs font-semibold text-text-light">{label}</p>
    <p className="mt-1 text-2xl font-black tabular-nums text-text">{value}</p>
  </div>
);

const StatsPanel = ({ isAr, stats }: { isAr: boolean; stats: Record<string, unknown> | null }) => {
  const byGender = (stats?.byGender || {}) as Record<string, number>;
  const byMawhiba = (stats?.byMawhiba || {}) as Record<string, number>;
  if (!stats) {
    return (
      <section className="rounded-2xl border border-gray-200 bg-white p-4">
        <h3 className="mb-2 text-sm font-bold text-text">{isAr ? "الإحصائيات" : "Statistics"}</h3>
        <p className="text-xs text-text-light">{isAr ? "لا توجد بيانات." : "No data."}</p>
      </section>
    );
  }
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-bold text-text">{isAr ? "الإحصائيات" : "Statistics"}</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        <MetricCardSmall label={isAr ? "إنجازات الطلاب" : "Boys achievements"} value={byGender.achievementsBoys || 0} />
        <MetricCardSmall label={isAr ? "إنجازات الطالبات" : "Girls achievements"} value={byGender.achievementsGirls || 0} />
        <MetricCardSmall label={isAr ? "الطلاب المشاركون" : "Boys participants"} value={byGender.participantsBoys || 0} />
        <MetricCardSmall label={isAr ? "الطالبات المشاركات" : "Girls participants"} value={byGender.participantsGirls || 0} />
        <MetricCardSmall label={isAr ? "شهادات الطلاب" : "Boys certificates"} value={byGender.certificatesBoys || 0} />
        <MetricCardSmall label={isAr ? "شهادات الطالبات" : "Girls certificates"} value={byGender.certificatesGirls || 0} />
        <MetricCardSmall
          label={isAr ? "إنجازات موهبة" : "Mawhiba achievements"}
          value={byMawhiba.achievementsMawhiba || 0}
        />
        <MetricCardSmall
          label={isAr ? "إنجازات غير موهبة" : "Non‑Mawhiba achievements"}
          value={byMawhiba.achievementsNonMawhiba || 0}
        />
        <MetricCardSmall
          label={isAr ? "طلاب موهبة (فريدون)" : "Mawhiba students (distinct)"}
          value={byMawhiba.participantsMawhiba || 0}
        />
        <MetricCardSmall
          label={isAr ? "طلاب غير موهبة (فريدون)" : "Non‑Mawhiba students (distinct)"}
          value={byMawhiba.participantsNonMawhiba || 0}
        />
      </div>
    </section>
  );
};

const TopStudentsPanel = ({ isAr, adminStats }: { isAr: boolean; adminStats: Record<string, unknown> | null }) => {
  const top = (adminStats?.topStudents || []) as Array<Record<string, unknown>>;
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-bold text-text">{isAr ? "الطلاب الأكثر إنجازًا" : "Top students"}</h3>
      {top.length === 0 ? (
        <p className="text-xs text-text-light">{isAr ? "لا توجد بيانات." : "No data."}</p>
      ) : (
        <ul className="space-y-2">
          {top.slice(0, 8).map((s, i) => (
            <li key={i} className="rounded-lg border border-gray-100 bg-gray-50/70 p-2 text-xs">
              <p className="font-bold text-text">{String(s.studentName || "—")}</p>
              <p className="mt-1 text-text-light">
                {isAr ? "الصف" : "Grade"}: {getGradeLabel(String(s.grade || ""), isAr ? "ar" : "en")} ·{" "}
                {isAr ? "المرحلة" : "Stage"}:{" "}
                {String((isAr ? s.stageLabelAr : s.stageLabelEn || s.stageLabelAr) || "—")}
              </p>
              <p className="mt-1 text-text-light">
                {isAr ? "الإجمالي" : "Total"}: {String(s.total || 0)} · {isAr ? "المعتمد" : "Approved"}:{" "}
                {String(s.approved || 0)} · {isAr ? "الشهادات" : "Certificates"}: {String(s.certificates || 0)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

const MetricCardSmall = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
    <p className="text-[11px] font-semibold text-text-light">{label}</p>
    <p className="mt-0.5 text-lg font-black tabular-nums text-text">{value}</p>
  </div>
);

export default function AdminAchievementReportsPage() {
  return (
    <Suspense
      fallback={
        <PageContainer>
          <p className="py-12 text-center text-sm text-slate-600">Loading reports…</p>
        </PageContainer>
      }
    >
      <AdminAchievementReportsPageInner />
    </Suspense>
  );
}
