"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import { getLocale } from "@/lib/i18n";
import {
  DEFAULT_ALUMNI_REPORT_FILTERS,
  type AlumniReportFiltersState,
  type AlumniReportKind,
  type AlumniReportMeta,
  type AlumniReportRow,
  type AlumniReportSummary,
} from "@/lib/alumni/alumni-report-types";
import { alumniReportFiltersToSearchParams } from "@/lib/alumni/alumni-report-filters";
import {
  exportAlumniOverviewExcel,
  exportAlumniOverviewPdfPrint,
  buildAlumniStrategicPdfAppendixHtml,
} from "@/lib/alumni/alumni-report-export";
import type { AlumniPdfExportMode } from "@/lib/pdf/alumni-pdf-layout";
import type { StrategicSeriesPoint } from "@/lib/alumni/analytics/trend-analysis";
import MultiSelect from "@/components/ui/multi-select";
import { ALUMNI_ACTIVATION_STATUS_VALUES } from "@/lib/alumni/alumni-activation-ui";
import { Loader2, FileSpreadsheet, FileText, Printer, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";

type OverviewPayload = {
  rows: AlumniReportRow[];
  total: number;
  summary: AlumniReportSummary | null;
  page: number;
  pageSize: number;
};

const REPUTATION_TIER_OPTIONS = ["Bronze", "Silver", "Gold", "Elite", "Ambassador", "Legend"];

const VERIFICATION_SOURCES: Array<{ value: string; labelAr: string }> = [
  { value: "linkedin", labelAr: "LinkedIn" },
  { value: "admin", labelAr: "إداري" },
  { value: "university_email", labelAr: "بريد جامعي" },
  { value: "career", labelAr: "مهني" },
  { value: "manual_admin", labelAr: "يدوي (إدارة)" },
  { value: "verification_request", labelAr: "طلب توثيق" },
  { value: "imported", labelAr: "مستورد" },
  { value: "legacy", labelAr: "قديم" },
];

const BarRow = ({ label, value, max }: { label: string; value: number; max: number }) => {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-bold text-slate-600">
        <span className="truncate">{label}</span>
        <span className="tabular-nums text-slate-900">{value}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const logExportAudit = async (body: {
  format: "excel" | "pdf";
  scope: "filtered" | "all";
  rowCount: number;
  reportKind: string;
  pdfMode?: AlumniPdfExportMode;
}) => {
  try {
    await fetch("/api/admin/alumni/reports/export-audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
  } catch {
    /* non-blocking */
  }
};

const AdminAlumniReportsPage = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [meta, setMeta] = useState<AlumniReportMeta | null>(null);
  const [kind, setKind] = useState<AlumniReportKind>("overview");
  const [filters, setFilters] = useState<AlumniReportFiltersState>(() => DEFAULT_ALUMNI_REPORT_FILTERS());
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  /** Bumps when user clicks "Apply filters" so typing in search does not spam the API. */
  const [filterTick, setFilterTick] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<OverviewPayload | null>(null);
  const [extra, setExtra] = useState<Record<string, unknown> | null>(null);
  const [pdfExportMode, setPdfExportMode] = useState<AlumniPdfExportMode>("executive");

  useEffect(() => {
    let m = true;
    void (async () => {
      try {
        const res = await fetch("/api/admin/alumni/reports?meta=1", { credentials: "include" });
        if (!res.ok) {
          if (m) setAllowed(false);
          return;
        }
        if (m) setAllowed(true);
        const j = await res.json();
        if (m && j.ok && j.meta) setMeta(j.meta as AlumniReportMeta);
      } catch {
        if (m) setAllowed(false);
      }
    })();
    return () => {
      m = false;
    };
  }, []);

  const loadReport = useCallback(async () => {
    void filterTick;
    if (!allowed) return;
    setLoading(true);
    setError(null);
    try {
      const sp = alumniReportFiltersToSearchParams(filtersRef.current);
      sp.set("kind", kind);
      sp.set("page", String(page));
      sp.set("pageSize", String(pageSize));
      const res = await fetch(`/api/admin/alumni/reports?${sp.toString()}`, { credentials: "include" });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setError(isAr ? "تعذر تحميل التقرير." : "Failed to load report.");
        return;
      }
      if (kind === "overview") {
        setOverview({
          rows: (j.rows || []) as AlumniReportRow[],
          total: Number(j.total || 0),
          summary: (j.summary || null) as AlumniReportSummary | null,
          page: Number(j.page || 1),
          pageSize: Number(j.pageSize || pageSize),
        });
        setExtra(null);
      } else {
        setOverview(null);
        setExtra(j as Record<string, unknown>);
      }
    } catch {
      setError(isAr ? "خطأ شبكة." : "Network error.");
    } finally {
      setLoading(false);
    }
  }, [allowed, kind, page, pageSize, isAr, filterTick]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const graduationOptions = useMemo(
    () =>
      (meta?.graduationYears || []).map((y) => ({
        value: String(y),
        label: String(y),
      })),
    [meta]
  );

  const stringOptions = (values: string[]) =>
    values.map((v) => ({ value: v, label: v }));

  const activationOptions = useMemo(
    () =>
      ALUMNI_ACTIVATION_STATUS_VALUES.map((v) => ({
        value: v,
        label: v,
      })),
    []
  );

  const genderOptions = useMemo(
    () => [
      { value: "male", label: isAr ? "ذكر" : "Male" },
      { value: "female", label: isAr ? "أنثى" : "Female" },
    ],
    [isAr]
  );

  const verificationTierOptions = useMemo(
    () =>
      (["basic", "academic", "career", "institution", "global"] as const).map((v) => ({
        value: v,
        label: v,
      })),
    []
  );

  const verificationSourceOptions = useMemo(
    () =>
      VERIFICATION_SOURCES.map((s) => ({
        value: s.value,
        label: isAr ? s.labelAr : s.value,
      })),
    [isAr]
  );

  const reputationTierOpts = useMemo(
    () => REPUTATION_TIER_OPTIONS.map((t) => ({ value: t, label: t })),
    []
  );

  const resetFilters = () => {
    setFilters(DEFAULT_ALUMNI_REPORT_FILTERS());
    setPage(1);
    setFilterTick((n) => n + 1);
  };

  const handleApplyFilters = () => {
    setPage(1);
    setFilterTick((n) => n + 1);
  };

  const totalPages = overview ? Math.max(1, Math.ceil(overview.total / pageSize)) : 1;

  const fetchOverviewSummary = useCallback(async (): Promise<AlumniReportSummary | null> => {
    const sp = alumniReportFiltersToSearchParams(filtersRef.current);
    sp.set("kind", "overview");
    sp.set("page", "1");
    sp.set("pageSize", "1");
    const res = await fetch(`/api/admin/alumni/reports?${sp.toString()}`, { credentials: "include" });
    const j = await res.json();
    if (!res.ok || !j.ok) return null;
    return (j.summary ?? null) as AlumniReportSummary | null;
  }, []);

  const fetchAllOverviewRows = async (): Promise<AlumniReportRow[]> => {
    const cap = 80;
    const out: AlumniReportRow[] = [];
    for (let p = 1; p <= cap; p += 1) {
      const sp = alumniReportFiltersToSearchParams(filtersRef.current);
      sp.set("kind", "overview");
      sp.set("page", String(p));
      sp.set("pageSize", "100");
      const res = await fetch(`/api/admin/alumni/reports?${sp.toString()}`, { credentials: "include" });
      const j = await res.json();
      if (!res.ok || !j.ok) break;
      const chunk = (j.rows || []) as AlumniReportRow[];
      out.push(...chunk);
      if (chunk.length < 100) break;
    }
    return out;
  };

  const handleExportExcel = async (scope: "filtered" | "all") => {
    if (kind !== "overview") return;
    const rows =
      scope === "all"
        ? await fetchAllOverviewRows()
        : overview?.rows?.length
          ? overview.rows
          : [];
    const title = isAr ? "تقرير خريجي الأنجال — نظرة عامة" : "Anjal alumni — overview";
    const base = `alumni-report-${scope}-${new Date().toISOString().slice(0, 10)}`;
    await logExportAudit({ format: "excel", scope, rowCount: rows.length, reportKind: kind });
    await exportAlumniOverviewExcel(rows, title, base);
  };

  const handleExportPdf = async (scope: "filtered" | "all") => {
    if (kind !== "overview") return;
    const rows =
      scope === "all"
        ? await fetchAllOverviewRows()
        : overview?.rows?.length
          ? overview.rows
          : [];
    const title = isAr ? "تقرير خريجي الأنجال — نظرة عامة" : "Anjal alumni — overview";
    await logExportAudit({ format: "pdf", scope, rowCount: rows.length, reportKind: kind, pdfMode: pdfExportMode });
    let appendix = "";
    try {
      const res = await fetch("/api/admin/alumni/analytics/history?granularity=monthly&limit=18", {
        credentials: "include",
      });
      const j = (await res.json()) as { ok?: boolean; data?: { strategicSeries?: StrategicSeriesPoint[] } };
      if (j.ok && j.data?.strategicSeries?.length) {
        appendix = buildAlumniStrategicPdfAppendixHtml(j.data.strategicSeries, isAr);
      }
    } catch {
      /* appendix optional */
    }
    const exportSummary =
      scope === "filtered" && overview?.summary != null ? overview.summary : await fetchOverviewSummary();
    await exportAlumniOverviewPdfPrint(rows, title, "/report-header.png", appendix, {
      mode: pdfExportMode,
      summary: exportSummary,
      locale: isAr ? "ar" : "en",
    });
  };

  const handlePrint = () => {
    void handleExportPdf("filtered");
  };

  const activeFilterChips = useMemo(() => {
    const chips: string[] = [];
    if (filters.q) chips.push(`${isAr ? "بحث" : "Search"}: ${filters.q}`);
    if (filters.graduationYears.length) chips.push(`${isAr ? "سنة التخرج" : "Grad year"}: ${filters.graduationYears.join(",")}`);
    if (filters.universities.length) chips.push(`${isAr ? "جامعة" : "University"} ×${filters.universities.length}`);
    if (filters.verifiedAlumni !== "all") chips.push(`${isAr ? "التوثيق" : "Verified"}: ${filters.verifiedAlumni}`);
    return chips;
  }, [filters, isAr]);

  const summary = overview?.summary;

  const tabs: { id: AlumniReportKind; ar: string; en: string }[] = [
    { id: "overview", ar: "عام", en: "Overview" },
    { id: "universities", ar: "الجامعات", en: "Universities" },
    { id: "careers", ar: "المسارات المهنية", en: "Careers" },
    { id: "community", ar: "المجتمع", en: "Community" },
    { id: "verification", ar: "التوثيق", en: "Verification" },
    { id: "reputation", ar: "السمعة", en: "Reputation" },
  ];

  return (
    <PageContainer>
      <PageHeader
        title={isAr ? "تقارير مجتمع خريجي الأنجال" : "Anjal alumni reporting"}
        subtitle={
          isAr
            ? "تحليل شامل، تصدير Excel/PDF، وطباعة رسمية مع الحفاظ على سرية البيانات."
            : "Deep analytics, Excel/PDF export, and print-ready official layouts."
        }
      />

      {allowed === false ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {isAr ? "لا تملك صلاحية الوصول إلى تقارير الخريجين." : "You do not have access to alumni reports."}
        </div>
      ) : null}

      {allowed === null ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
        </div>
      ) : null}

      {allowed ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setKind(t.id);
                  setPage(1);
                }}
                className={`rounded-full px-4 py-1.5 text-xs font-bold ring-1 transition ${
                  kind === t.id ? "bg-primary text-white ring-primary" : "bg-white text-text ring-gray-200 hover:bg-gray-50"
                }`}
              >
                {isAr ? t.ar : t.en}
              </button>
            ))}
          </div>

          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-black text-text">{isAr ? "الفلاتر" : "Filters"}</h2>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void loadReport()}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-text hover:bg-gray-50"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  {isAr ? "تحديث" : "Refresh"}
                </button>
                <button
                  type="button"
                  onClick={handleApplyFilters}
                  className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white hover:opacity-95"
                >
                  {isAr ? "تطبيق الفلاتر" : "Apply filters"}
                </button>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-text hover:bg-gray-50"
                >
                  {isAr ? "مسح الفلاتر" : "Reset filters"}
                </button>
              </div>
            </div>
            <label className="mb-3 flex flex-col text-xs font-semibold text-text-light">
              {isAr ? "بحث شامل (عربي / إنجليزي / أرقام)" : "Global search"}
              <input
                value={filters.q}
                onChange={(e) => setFilters((p) => ({ ...p, q: e.target.value }))}
                className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-text"
                placeholder={isAr ? "اسم، بريد، جامعة، وظيفة…" : "Name, email, university, job…"}
              />
            </label>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <MultiSelect
                label={isAr ? "سنة التخرج" : "Graduation year"}
                placeholder={isAr ? "اختر السنوات" : "Select years"}
                options={graduationOptions}
                value={filters.graduationYears.map(String)}
                onChange={(next) =>
                  setFilters((p) => ({ ...p, graduationYears: next.map((x) => Number(x)).filter((n) => Number.isFinite(n)) }))
                }
                isRtl={isAr}
                maxVisibleChips={2}
                selectAllLabel={isAr ? "الكل" : "All"}
                clearLabel={isAr ? "مسح" : "Clear"}
              />
              <MultiSelect
                label={isAr ? "الجامعة" : "University"}
                placeholder={isAr ? "اختر الجامعات" : "Select universities"}
                options={stringOptions((meta?.universities || []).slice(0, 300))}
                value={filters.universities}
                onChange={(next) => setFilters((p) => ({ ...p, universities: next }))}
                isRtl={isAr}
                maxVisibleChips={2}
                selectAllLabel={isAr ? "الكل" : "All"}
                clearLabel={isAr ? "مسح" : "Clear"}
              />
              <MultiSelect
                label={isAr ? "دولة الدراسة" : "Study country"}
                placeholder={isAr ? "اختر الدول" : "Select countries"}
                options={stringOptions((meta?.studyCountries || []).slice(0, 200))}
                value={filters.studyCountries}
                onChange={(next) => setFilters((p) => ({ ...p, studyCountries: next }))}
                isRtl={isAr}
                maxVisibleChips={2}
                selectAllLabel={isAr ? "الكل" : "All"}
                clearLabel={isAr ? "مسح" : "Clear"}
              />
              <MultiSelect
                label={isAr ? "التخصص" : "Major"}
                placeholder={isAr ? "اختر التخصصات" : "Select majors"}
                options={stringOptions((meta?.majors || []).slice(0, 300))}
                value={filters.majors}
                onChange={(next) => setFilters((p) => ({ ...p, majors: next }))}
                isRtl={isAr}
                maxVisibleChips={2}
                selectAllLabel={isAr ? "الكل" : "All"}
                clearLabel={isAr ? "مسح" : "Clear"}
              />
              <MultiSelect
                label={isAr ? "الجنس" : "Gender"}
                placeholder={isAr ? "اختر" : "Select"}
                options={genderOptions}
                value={filters.genders}
                onChange={(next) =>
                  setFilters((p) => ({ ...p, genders: next.filter((g): g is "male" | "female" => g === "male" || g === "female") }))
                }
                isRtl={isAr}
                maxVisibleChips={2}
                selectAllLabel={isAr ? "الكل" : "All"}
                clearLabel={isAr ? "مسح" : "Clear"}
              />
              <MultiSelect
                label={isAr ? "حالة التفعيل" : "Activation"}
                placeholder={isAr ? "اختر الحالات" : "Select statuses"}
                options={activationOptions}
                value={filters.activationStatuses}
                onChange={(next) => setFilters((p) => ({ ...p, activationStatuses: next }))}
                isRtl={isAr}
                maxVisibleChips={2}
                selectAllLabel={isAr ? "الكل" : "All"}
                clearLabel={isAr ? "مسح" : "Clear"}
              />
              <label className="flex flex-col text-xs font-semibold text-text-light">
                {isAr ? "حالة التوثيق (الملف)" : "Profile verified"}
                <select
                  value={filters.verifiedAlumni}
                  onChange={(e) =>
                    setFilters((p) => ({
                      ...p,
                      verifiedAlumni: e.target.value as AlumniReportFiltersState["verifiedAlumni"],
                    }))
                  }
                  className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="all">{isAr ? "الكل" : "All"}</option>
                  <option value="yes">{isAr ? "موثّق" : "Verified"}</option>
                  <option value="no">{isAr ? "غير موثّق" : "Not verified"}</option>
                </select>
              </label>
              <MultiSelect
                label={isAr ? "مستوى التوثيق" : "Verification tier"}
                placeholder={isAr ? "اختر" : "Select"}
                options={verificationTierOptions}
                value={filters.verificationTiers}
                onChange={(next) =>
                  setFilters((p) => ({
                    ...p,
                    verificationTiers: next.filter((x): x is AlumniReportFiltersState["verificationTiers"][number] =>
                      ["basic", "academic", "career", "institution", "global"].includes(x)
                    ),
                  }))
                }
                isRtl={isAr}
                maxVisibleChips={2}
                selectAllLabel={isAr ? "الكل" : "All"}
                clearLabel={isAr ? "مسح" : "Clear"}
              />
              <MultiSelect
                label={isAr ? "مصدر التوثيق" : "Verification source"}
                placeholder={isAr ? "اختر" : "Select"}
                options={verificationSourceOptions}
                value={filters.verificationSources}
                onChange={(next) =>
                  setFilters((p) => ({
                    ...p,
                    verificationSources: next.filter((x): x is AlumniReportFiltersState["verificationSources"][number] =>
                      VERIFICATION_SOURCES.some((s) => s.value === x)
                    ),
                  }))
                }
                isRtl={isAr}
                maxVisibleChips={2}
                selectAllLabel={isAr ? "الكل" : "All"}
                clearLabel={isAr ? "مسح" : "Clear"}
              />
              <label className="flex flex-col text-xs font-semibold text-text-light">
                {isAr ? "آخر طلب توثيق" : "Latest verification ticket"}
                <select
                  value={filters.verificationTicket}
                  onChange={(e) =>
                    setFilters((p) => ({
                      ...p,
                      verificationTicket: e.target.value as AlumniReportFiltersState["verificationTicket"],
                    }))
                  }
                  className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="all">{isAr ? "الكل" : "All"}</option>
                  <option value="pending">{isAr ? "قيد المراجعة" : "Pending"}</option>
                  <option value="approved">{isAr ? "معتمد" : "Approved"}</option>
                  <option value="rejected">{isAr ? "مرفوض" : "Rejected"}</option>
                  <option value="none">{isAr ? "لا يوجد طلب" : "No ticket"}</option>
                </select>
              </label>
              <MultiSelect
                label={isAr ? "مستوى السمعة (شارات النظام)" : "Reputation ladder"}
                placeholder={isAr ? "اختر" : "Select"}
                options={reputationTierOpts}
                value={filters.reputationTiers}
                onChange={(next) => setFilters((p) => ({ ...p, reputationTiers: next }))}
                isRtl={isAr}
                maxVisibleChips={2}
                selectAllLabel={isAr ? "الكل" : "All"}
                clearLabel={isAr ? "مسح" : "Clear"}
              />
              <MultiSelect
                label={isAr ? "الدولة الحالية" : "Current country"}
                placeholder={isAr ? "اختر" : "Select"}
                options={stringOptions((meta?.currentCountries || []).slice(0, 200))}
                value={filters.currentCountries}
                onChange={(next) => setFilters((p) => ({ ...p, currentCountries: next }))}
                isRtl={isAr}
                maxVisibleChips={2}
                selectAllLabel={isAr ? "الكل" : "All"}
                clearLabel={isAr ? "مسح" : "Clear"}
              />
              <MultiSelect
                label={isAr ? "مجال العمل" : "Industry"}
                placeholder={isAr ? "اختر" : "Select"}
                options={stringOptions((meta?.industries || []).slice(0, 200))}
                value={filters.industries}
                onChange={(next) => setFilters((p) => ({ ...p, industries: next }))}
                isRtl={isAr}
                maxVisibleChips={2}
                selectAllLabel={isAr ? "الكل" : "All"}
                clearLabel={isAr ? "مسح" : "Clear"}
              />
              {(
                [
                  ["hasOpportunities", isAr ? "فرص مسجّلة" : "Has opportunities"],
                  ["hasStories", isAr ? "قصص" : "Has stories"],
                  ["hasMemories", isAr ? "ذكريات معتمدة" : "Has memories"],
                  ["mentorFilter", isAr ? "إرشاد" : "Mentoring"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex flex-col text-xs font-semibold text-text-light">
                  {label}
                  <select
                    value={filters[key]}
                    onChange={(e) =>
                      setFilters((p) => ({
                        ...p,
                        [key]: e.target.value as AlumniReportFiltersState[typeof key],
                      }))
                    }
                    className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="all">{isAr ? "الكل" : "All"}</option>
                    <option value="yes">{isAr ? "نعم" : "Yes"}</option>
                    <option value="no">{isAr ? "لا" : "No"}</option>
                  </select>
                </label>
              ))}
            </div>
            {activeFilterChips.length ? (
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-text-light">
                <span className="font-bold">{isAr ? "فلاتر نشطة:" : "Active:"}</span>
                {activeFilterChips.map((c) => (
                  <span key={c} className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-800 ring-1 ring-slate-200">
                    {c}
                  </span>
                ))}
              </div>
            ) : null}
          </section>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
          ) : null}

          {loading && !overview && !extra ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
            </div>
          ) : null}

          {kind === "overview" && summary && overview ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
              {[
                [isAr ? "الخريجون" : "Alumni", summary.alumniCount],
                [isAr ? "جامعات (مميزة)" : "Universities (distinct)", summary.distinctUniversities],
                [isAr ? "دول (مميزة)" : "Countries (distinct)", summary.distinctCountries],
                [isAr ? "مرشدون / عارضو إرشاد" : "Mentors / offers", summary.mentorsOffering],
                [isAr ? "فرص (إجمالي مسجّل)" : "Opportunity rows", summary.opportunityRows],
                [isAr ? "قصص (مجموع)" : "Stories (sum)", summary.storyCount],
                [isAr ? "ذكريات معتمدة" : "Memories approved", summary.memoryApproved],
                [isAr ? "متوسط السمعة" : "Avg reputation", summary.avgReputation],
                [isAr ? "أكثر دفعة" : "Top cohort", summary.topCohortYear],
                [isAr ? "أكثر جامعة" : "Top university", summary.topUniversity],
              ].map(([k, v]) => (
                <div key={String(k)} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                  <p className="text-xs font-semibold text-text-light">{k}</p>
                  <p className="mt-1 text-xl font-black tabular-nums text-text">{v}</p>
                </div>
              ))}
            </div>
          ) : null}

          {kind === "overview" && overview ? (
            <section className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-text">{isAr ? "جدول الخريجين" : "Alumni table"}</h3>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                  <label className="flex items-center gap-2 text-xs font-semibold text-text">
                    <span>{isAr ? "تخطيط PDF" : "PDF layout"}</span>
                    <select
                      value={pdfExportMode}
                      onChange={(e) => setPdfExportMode(e.target.value as AlumniPdfExportMode)}
                      className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs font-bold text-text"
                    >
                      <option value="executive">{isAr ? "تنفيذي (ملخص + جداول مجمّعة)" : "Executive"}</option>
                      <option value="compact_tables">{isAr ? "جداول مدمجة" : "Compact tables"}</option>
                      <option value="detailed_cards">{isAr ? "بطاقات تفصيلية" : "Detailed cards"}</option>
                      <option value="print_friendly">{isAr ? "طباعة أوضح" : "Print-friendly"}</option>
                    </select>
                  </label>
                  <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleExportExcel("filtered")}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    {isAr ? "Excel (الفلاتر)" : "Excel (filtered)"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleExportExcel("all")}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-600 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-50"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    {isAr ? "Excel (الكل)" : "Excel (all)"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleExportPdf("filtered")}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    PDF
                  </button>
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-400 px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-50"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    {isAr ? "طباعة" : "Print"}
                  </button>
                </div>
                </div>
              </div>
              <div className="overflow-x-auto rounded-lg border border-gray-100">
                <table className="min-w-[2200px] text-xs">
                  <thead className="bg-gray-50 text-text">
                    <tr>
                      {(isAr
                        ? ["الاسم", "البريد", "الجامعة", "التخصص", "الوظيفة", "القطاع", "سنة التخرج", "الموثّق", "السمعة", "القصص", "الفرص", "الذكريات", "الإرشاد"]
                        : ["Name", "Email", "University", "Major", "Role", "Industry", "Grad year", "Verified", "Reputation", "Stories", "Opps", "Memories", "Mentor"]
                      ).map((h) => (
                        <th key={h} className="px-2 py-2 text-start font-bold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {!overview?.rows?.length ? (
                      <tr>
                        <td colSpan={13} className="px-3 py-8 text-center text-text-light">
                          {isAr ? "لا توجد بيانات." : "No data."}
                        </td>
                      </tr>
                    ) : (
                      overview.rows.map((r) => (
                        <tr key={r.id} className="border-t border-gray-100 odd:bg-white even:bg-gray-50/40">
                          <td className="px-2 py-2 font-semibold">{r.fullName}</td>
                          <td className="px-2 py-2">{r.email}</td>
                          <td className="px-2 py-2">{r.universityName}</td>
                          <td className="px-2 py-2">{r.major}</td>
                          <td className="px-2 py-2">{r.jobTitle}</td>
                          <td className="px-2 py-2">{r.industry}</td>
                          <td className="px-2 py-2">{r.graduationYear}</td>
                          <td className="px-2 py-2">{r.isVerifiedAlumni}</td>
                          <td className="px-2 py-2">{r.reputationScore}</td>
                          <td className="px-2 py-2">{r.storyCount}</td>
                          <td className="px-2 py-2">{r.opportunityCount}</td>
                          <td className="px-2 py-2">{r.memoryApprovedCount}</td>
                          <td className="px-2 py-2">
                            {r.offersMentoring}/{r.mentorCases}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-text-light">
                <span>
                  {isAr ? "الصفحة" : "Page"} {page} / {totalPages} — {overview?.total ?? 0}{" "}
                  {isAr ? "سجلًا" : "rows"}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 font-bold disabled:opacity-40"
                  >
                    <ChevronRight className="h-4 w-4" />
                    {isAr ? "السابق" : "Prev"}
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages || loading}
                    onClick={() => setPage((p) => p + 1)}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 font-bold disabled:opacity-40"
                  >
                    {isAr ? "التالي" : "Next"}
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          {kind === "universities" && extra?.rows ? (
            <section className="rounded-2xl border border-gray-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-bold">{isAr ? "توزيع الجامعات" : "Universities distribution"}</h3>
              <div className="grid max-h-[420px] gap-2 overflow-y-auto pr-1 lg:grid-cols-2">
                {(() => {
                  const rows = extra.rows as { universityName: string; alumniCount: number }[];
                  const max = Math.max(1, ...rows.map((r) => r.alumniCount));
                  return rows.map((r) => (
                    <BarRow key={r.universityName} label={r.universityName} value={r.alumniCount} max={max} />
                  ));
                })()}
              </div>
            </section>
          ) : null}

          {kind === "careers" && extra?.rows ? (
            <section className="rounded-2xl border border-gray-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-bold">{isAr ? "المسارات المهنية" : "Career paths"}</h3>
              <div className="overflow-x-auto">
                <table className="min-w-[640px] text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-2">{isAr ? "القطاع" : "Industry"}</th>
                      <th className="px-2 py-2">{isAr ? "المنصب" : "Position"}</th>
                      <th className="px-2 py-2">{isAr ? "العدد" : "Count"}</th>
                      <th className="px-2 py-2">{isAr ? "متوسط السمعة" : "Avg reputation"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(extra.rows as { industry: string; position: string; count: number; avgReputation: string }[]).map(
                      (r, i) => (
                        <tr key={`${r.industry}-${r.position}-${i}`} className="border-t border-gray-100">
                          <td className="px-2 py-2">{r.industry}</td>
                          <td className="px-2 py-2">{r.position}</td>
                          <td className="px-2 py-2">{r.count}</td>
                          <td className="px-2 py-2">{r.avgReputation}</td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {kind === "community" && extra?.data ? (
            <section className="rounded-2xl border border-gray-200 bg-white p-4 text-sm">
              {(() => {
                const d = extra.data as {
                  storiesTotal: number;
                  storiesPublished: number;
                  opportunitiesByUser: number;
                  memoryPostsTotal: number;
                  memoryPostsApproved: number;
                  mentorshipRequestsTotal: number;
                  topStoryAuthors: { userId: string; name: string; count: number }[];
                };
                return (
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-2">
                      <p>
                        <strong>{isAr ? "القصص" : "Stories"}:</strong> {d.storiesTotal} ({isAr ? "منشور" : "published"}:{" "}
                        {d.storiesPublished})
                      </p>
                      <p>
                        <strong>{isAr ? "فرص مسجّلة لدى الخريجين" : "Opportunities (by alumni)"}:</strong>{" "}
                        {d.opportunitiesByUser}
                      </p>
                      <p>
                        <strong>{isAr ? "الذكريات" : "Memories"}:</strong> {d.memoryPostsTotal} —{" "}
                        {isAr ? "معتمدة" : "approved"}: {d.memoryPostsApproved}
                      </p>
                      <p>
                        <strong>{isAr ? "طلبات الإرشاد (المنصة)" : "Mentorship requests"}:</strong>{" "}
                        {d.mentorshipRequestsTotal}
                      </p>
                    </div>
                    <div>
                      <p className="mb-2 font-bold">{isAr ? "أكثر الخريجين قصصًا" : "Top story authors"}</p>
                      <ul className="space-y-1 text-xs">
                        {d.topStoryAuthors.map((a) => (
                          <li key={a.userId} className="flex justify-between gap-2">
                            <span className="truncate">{a.name || a.userId}</span>
                            <span className="tabular-nums font-bold">{a.count}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })()}
            </section>
          ) : null}

          {kind === "verification" && extra?.data ? (
            <section className="rounded-2xl border border-gray-200 bg-white p-4 text-sm">
              {(() => {
                const d = extra.data as {
                  profileVerified: number;
                  profileUnverified: number;
                  ticketsPending: number;
                  ticketsApproved: number;
                  ticketsRejected: number;
                  bySource: { source: string; count: number }[];
                  byTier: { tier: string; count: number }[];
                };
                return (
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-2">
                      <p>
                        <strong>{isAr ? "موثّقون (ملف)" : "Profile verified"}:</strong> {d.profileVerified}
                      </p>
                      <p>
                        <strong>{isAr ? "غير موثّقين" : "Unverified"}:</strong> {d.profileUnverified}
                      </p>
                      <p>
                        <strong>{isAr ? "تذاكر: قيد / معتمد / مرفوض" : "Tickets P/A/R"}:</strong>{" "}
                        {d.ticketsPending}/{d.ticketsApproved}/{d.ticketsRejected}
                      </p>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <p className="mb-1 font-bold">{isAr ? "حسب المصدر" : "By source"}</p>
                        {d.bySource.map((x) => (
                          <BarRow key={x.source} label={x.source} value={x.count} max={Math.max(1, ...d.bySource.map((s) => s.count))} />
                        ))}
                      </div>
                      <div>
                        <p className="mb-1 font-bold">{isAr ? "حسب المستوى" : "By tier"}</p>
                        {d.byTier.map((x) => (
                          <BarRow key={x.tier} label={x.tier} value={x.count} max={Math.max(1, ...d.byTier.map((s) => s.count))} />
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </section>
          ) : null}

          {kind === "reputation" && extra?.rows ? (
            <section className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="overflow-x-auto">
                <table className="min-w-[720px] text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-2">{isAr ? "الاسم" : "Name"}</th>
                      <th className="px-2 py-2">{isAr ? "البريد" : "Email"}</th>
                      <th className="px-2 py-2">{isAr ? "السمعة" : "Reputation"}</th>
                      <th className="px-2 py-2">{isAr ? "الثقة" : "Trust"}</th>
                      <th className="px-2 py-2">{isAr ? "الشارات" : "Badges"}</th>
                      <th className="px-2 py-2">{isAr ? "المستويات" : "Tiers"}</th>
                      <th className="px-2 py-2">{isAr ? "الشبكة" : "Network"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      extra.rows as {
                        userId: string;
                        fullName: string;
                        email: string;
                        reputationScore: number;
                        trustScore: string;
                        badges: string;
                        tiers: string;
                        networkStrength: number;
                      }[]
                    ).map((r) => (
                      <tr key={r.userId} className="border-t border-gray-100">
                        <td className="px-2 py-2 font-semibold">{r.fullName}</td>
                        <td className="px-2 py-2">{r.email}</td>
                        <td className="px-2 py-2">{r.reputationScore}</td>
                        <td className="px-2 py-2">{r.trustScore}</td>
                        <td className="px-2 py-2">{r.badges}</td>
                        <td className="px-2 py-2">{r.tiers}</td>
                        <td className="px-2 py-2">{r.networkStrength}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex justify-between text-xs text-text-light">
                <span>
                  {isAr ? "إجمالي" : "Total"}: {Number(extra.total || 0)}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="rounded-lg border border-gray-300 px-2 py-1 font-bold disabled:opacity-40"
                  >
                    {isAr ? "السابق" : "Prev"}
                  </button>
                  <button
                    type="button"
                    disabled={loading || page * pageSize >= Number(extra.total || 0)}
                    onClick={() => setPage((p) => p + 1)}
                    className="rounded-lg border border-gray-300 px-2 py-1 font-bold disabled:opacity-40"
                  >
                    {isAr ? "التالي" : "Next"}
                  </button>
                </div>
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </PageContainer>
  );
};

export default AdminAlumniReportsPage;
