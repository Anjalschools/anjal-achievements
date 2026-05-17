"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import { getLocale } from "@/lib/i18n";
import { FocusedExecutiveIntelligencePanel } from "@/components/admin/FocusedExecutiveIntelligencePanel";
import {
  exportFocusedCompetitionAnalyticsPdf,
  exportFocusedExecutiveReportPdf,
  exportFocusedParticipantSelectionPdf,
  exportLandscapeExecutivePdfView,
  exportRowsToExcelWorkbook,
  type ExecutivePdfMetadata,
} from "@/lib/report-export";
import { CompetitionExportOverlay } from "@/components/admin/CompetitionExportOverlay";
import {
  runCompetitionExecutiveExport,
  type CompetitionExportState,
  exportPhaseMessages,
} from "@/lib/competition-export-controller";
import {
  readExecutiveSnapshot,
  writeExecutiveSnapshot,
  readSavedExecutiveViews,
  upsertSavedExecutiveView,
  type SavedExecutiveView,
  mergeExecutiveSnapshotIntoFilter,
  hydrateLocalStoragePanelsFromSnapshot,
  captureExecutiveAuxLocalState,
  cloneExecutiveFilterSnapshot,
  type ExecutiveFilterSnapshot,
  type ExecutiveUiSnapshot,
} from "@/lib/competition-intelligence-persistence";
import { competitionIntelDebug, isCompetitionIntelDebugEnabled } from "@/lib/competition-intelligence-diagnostics";
import { ciBuildFiltersSummary, ciMedalsPer100, CI_EXPORT_PARTICIPANT_ROW_CAP } from "@/lib/competition-intelligence-normalize";
import {
  mergeTrustReports,
  verifyComparisonConsistency,
  verifyMedalTotals,
  verifyOutcomeBuckets,
  verifyParticipantCounts,
  verifyStudentIntelRows,
  verifyYearTrend,
  formatCacheAgeLabel,
} from "@/lib/competition-intelligence-consistency";
import {
  ciRedactLine,
  createCorrelationId,
  logCompareIntel,
  logEmptyDatasetIntel,
} from "@/lib/competition-intelligence-debug";
import {
  appendCiExportAudit,
  buildDiagnosticsSummary,
  readCiExportAudit,
} from "@/lib/competition-intelligence-export-audit";
import { CI_AGGREGATION_VERSION } from "@/lib/competition/analytics/aggregation-version";
import { resilientFetchJson } from "@/lib/client/resilient-fetch";
import { runStudentIntelGovernance } from "@/lib/competition/governance/student-intel-governance";
import { getCompetitionIntelAccess } from "@/lib/competition-intelligence-permissions";
import {
  getReportCategoryOptions,
  getReportLevelOptions,
  getReportResultOptions,
} from "@/lib/report-filter-options";
import { GRADE_OPTIONS } from "@/constants/grades";
import type { StudentIntelligencePayload, StudentProfileInsightPayload } from "@/lib/student-intelligence-analytics";
import { CI_PDF_PRESET_LABELS, CI_STORAGE_KEYS, type CiPdfExportPreset } from "@/lib/competition-intelligence-theme";
import { Loader2, RefreshCw } from "lucide-react";
import type { ParticipationActivityRow, ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";
import {
  FOCUSED_ACHIEVEMENT_OUTCOMES,
  type FocusedActivityOptionsPayload,
  type FocusedActivityReportPayload,
} from "@/types/focused-activity-report";

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
  const [activeTab, setActiveTab] = useState<"general" | "focused" | "studentIntel">("general");
  const [data, setData] = useState<ParticipationAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataDegraded, setDataDegraded] = useState(false);
  const [page, setPage] = useState(1);
  const [focusedPage, setFocusedPage] = useState(1);
  const [execBoot] = useState(() => {
    if (typeof window === "undefined") {
      return { snap: {} as Partial<ExecutiveUiSnapshot> };
    }
    const snap = readExecutiveSnapshot();
    hydrateLocalStoragePanelsFromSnapshot(snap);
    return { snap };
  });

  const [focusedOutcome, setFocusedOutcome] = useState(() => execBoot.snap.focusedOutcome ?? "all");
  const [focusedPick, setFocusedPick] = useState(() => execBoot.snap.focusedPick ?? "");
  const [focusedActivityOptions, setFocusedActivityOptions] = useState<
    { typeKey: string; rawKey: string; count: number; labelAr: string; labelEn: string }[]
  >([]);
  const [focusedData, setFocusedData] = useState<FocusedActivityReportPayload | null>(null);
  const [focusedLoading, setFocusedLoading] = useState(false);
  const [focusedError, setFocusedError] = useState<string | null>(null);
  const [focusedOptionsLoading, setFocusedOptionsLoading] = useState(false);
  const [compareEnabled, setCompareEnabled] = useState(() => Boolean(execBoot.snap.compareEnabled));
  const [comparePick, setComparePick] = useState(() => execBoot.snap.comparePick ?? "");
  const [compareData, setCompareData] = useState<FocusedActivityReportPayload | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [studentIntelData, setStudentIntelData] = useState<StudentIntelligencePayload | null>(null);
  const [studentIntelLoading, setStudentIntelLoading] = useState(false);
  const [studentIntelError, setStudentIntelError] = useState<string | null>(null);
  const [pdfPreset, setPdfPreset] = useState<CiPdfExportPreset>(() => {
    const fromSnap = execBoot.snap.pdfPreset;
    if (fromSnap && (Object.keys(CI_PDF_PRESET_LABELS) as CiPdfExportPreset[]).includes(fromSnap)) {
      return fromSnap;
    }
    if (typeof window !== "undefined") {
      try {
        const v = localStorage.getItem(CI_STORAGE_KEYS.pdfPreset) as CiPdfExportPreset | null;
        if (v && (Object.keys(CI_PDF_PRESET_LABELS) as CiPdfExportPreset[]).includes(v)) return v;
      } catch {
        /* ignore */
      }
    }
    return "full";
  });
  const [studentProfilePid, setStudentProfilePid] = useState<string | null>(null);
  const [studentProfileReloadKey, setStudentProfileReloadKey] = useState(0);
  const [studentProfileData, setStudentProfileData] = useState<StudentProfileInsightPayload | null>(null);
  const [studentProfileLoading, setStudentProfileLoading] = useState(false);
  const [studentProfileError, setStudentProfileError] = useState<string | null>(null);
  const [f, setF] = useState<ExecutiveFilterSnapshot>(() => mergeExecutiveSnapshotIntoFilter(execBoot.snap));

  const [exportOverlayOpen, setExportOverlayOpen] = useState(false);
  const [exportState, setExportState] = useState<CompetitionExportState>({
    phase: "idle",
    messageAr: "",
    messageEn: "",
    attempt: 1,
  });
  const [userExportLabel, setUserExportLabel] = useState("");
  const [viewerRole, setViewerRole] = useState("");
  const [savedExecutiveViews, setSavedExecutiveViews] = useState<SavedExecutiveView[]>([]);
  const exportAttemptRef = useRef(1);
  const lastCompareLatencyMsRef = useRef<number | null>(null);

  const categoryOptions = useMemo(() => getReportCategoryOptions(isAr ? "ar" : "en"), [isAr]);
  const levelOptions = useMemo(() => getReportLevelOptions(isAr ? "ar" : "en"), [isAr]);
  const resultOptions = useMemo(() => getReportResultOptions(isAr ? "ar" : "en"), [isAr]);
  const intelAccess = useMemo(() => getCompetitionIntelAccess(viewerRole || undefined), [viewerRole]);

  const studentIntelGovernance = useMemo(() => {
    const age = studentIntelData?.ciObservability?.cacheAgeMs;
    return runStudentIntelGovernance(studentIntelData, age);
  }, [studentIntelData]);

  const analyticsTrustReport = useMemo(
    () =>
      mergeTrustReports([
        verifyOutcomeBuckets(data),
        verifyParticipantCounts(focusedData),
        verifyMedalTotals(focusedData),
        verifyYearTrend(focusedData),
        verifyComparisonConsistency(
          compareEnabled && comparePick ? focusedData : null,
          compareEnabled && comparePick ? compareData : null
        ),
        verifyStudentIntelRows(studentIntelData),
        {
          level: studentIntelGovernance.level,
          issues: studentIntelGovernance.issues.map((i) => i.code),
        },
      ]),
    [
      data,
      focusedData,
      compareData,
      studentIntelData,
      compareEnabled,
      comparePick,
      studentIntelGovernance,
    ]
  );

  const cacheAgeLabel = useMemo(() => {
    const obs =
      activeTab === "general" ? data?.ciObservability
      : activeTab === "focused" ? focusedData?.ciObservability
      : studentIntelData?.ciObservability;
    return formatCacheAgeLabel(obs?.generatedAt, isAr);
  }, [activeTab, data?.ciObservability, focusedData?.ciObservability, studentIntelData?.ciObservability, isAr]);

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
        setViewerRole(role);
        const label =
          typeof j.name === "string" && j.name.trim() ?
            j.name.trim()
          : typeof j.email === "string" && j.email.trim() ?
            j.email.trim()
          : "";
        setUserExportLabel(label);
        setAllowed(["admin", "supervisor", "schoolAdmin", "teacher", "judge"].includes(role));
      } catch {
        setAllowed(false);
      }
    })();
  }, []);

  useEffect(() => {
    setSavedExecutiveViews(readSavedExecutiveViews());
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const aux = captureExecutiveAuxLocalState();
      writeExecutiveSnapshot({
        focusedPick: focusedPick || undefined,
        comparePick: comparePick || undefined,
        compareEnabled,
        pdfPreset,
        focusedOutcome,
        filter: cloneExecutiveFilterSnapshot(f),
        collapseJson: aux.collapseJson,
        viewDensity: aux.viewDensity,
      });
    }, 400);
    return () => window.clearTimeout(t);
  }, [focusedPick, comparePick, compareEnabled, pdfPreset, focusedOutcome, f]);

  useEffect(() => {
    if (activeTab !== "studentIntel") {
      setStudentProfilePid(null);
      setStudentProfileData(null);
      setStudentProfileError(null);
    }
  }, [activeTab]);

  const buildSharedSearchParams = useCallback(() => {
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
    return sp;
  }, [f]);

  const buildQuery = useCallback(() => {
    const sp = buildSharedSearchParams();
    sp.set("page", String(page));
    sp.set("pageSize", "25");
    return sp.toString();
  }, [buildSharedSearchParams, page]);

  const buildFocusedParams = useCallback(() => {
    const sp = buildSharedSearchParams();
    if (f.primaryType && f.primaryType !== "all") sp.set("primaryType", f.primaryType);
    return sp;
  }, [buildSharedSearchParams, f.primaryType]);

  useEffect(() => {
    if (!studentProfilePid || activeTab !== "studentIntel" || allowed !== true) {
      return;
    }
    const ac = new AbortController();
    void (async () => {
      setStudentProfileError(null);
      const sp = buildFocusedParams();
      sp.set("participantId", studentProfilePid);
      const cacheKey = `anjal-ci-student-prof:${studentProfilePid}:${sp.toString()}`;
      try {
        const raw = sessionStorage.getItem(cacheKey);
        if (raw) {
          const parsed = JSON.parse(raw) as { ts?: number; payload?: StudentProfileInsightPayload };
          const ts = typeof parsed.ts === "number" ? parsed.ts : 0;
          if (parsed.payload && Date.now() - ts < 5 * 60_000) {
            setStudentProfileData(parsed.payload);
            setStudentProfileLoading(false);
            return;
          }
        }
      } catch {
        /* ignore corrupt cache */
      }
      setStudentProfileLoading(true);
      try {
        const res = await fetch(
          `/api/admin/reports/achievement-participation/student-intelligence/profile?${sp.toString()}`,
          { cache: "no-store", credentials: "include", signal: ac.signal }
        );
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (!res.ok) {
          throw new Error("Request failed");
        }
        const j = (await res.json()) as StudentProfileInsightPayload;
        setStudentProfileData(j);
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), payload: j }));
        } catch {
          /* ignore */
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setStudentProfileError(e instanceof Error ? e.message : "Error");
        setStudentProfileData(null);
      } finally {
        setStudentProfileLoading(false);
      }
    })();
    return () => ac.abort();
  }, [studentProfilePid, studentProfileReloadKey, activeTab, allowed, buildFocusedParams, router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setDataDegraded(false);
    const url = `/api/admin/reports/achievement-participation?${buildQuery()}`;
    const result = await resilientFetchJson<
      ParticipationAnalyticsPayload & { degraded?: boolean; error?: string }
    >(url, { credentials: "include" }, {
      staleKey: `anjal-participation:${buildQuery()}`,
      staleMaxAgeMs: 10 * 60_000,
      retries: 2,
    });
    if (!result.ok) {
      if (result.status === 401) {
        router.push("/login");
        return;
      }
      if (result.status === 403) {
        setAllowed(false);
        return;
      }
      setError(
        isAr ?
          "تعذر تحميل التقرير. جرّب إعادة المحاولة أو توسيع الفلاتر."
        : "Could not load the report. Retry or broaden filters."
      );
      setData(null);
      setLoading(false);
      return;
    }
    const j = result.data;
    if (!j.ok) {
      setError(typeof j.error === "string" ? j.error : "Request failed");
      setData(null);
    } else {
      setData(j);
      setDataDegraded(Boolean(result.degraded || result.fromStale || j.degraded));
    }
    setLoading(false);
  }, [buildQuery, router, isAr]);

  const fetchFocusedOptions = useCallback(async () => {
    setFocusedOptionsLoading(true);
    try {
      const sp = buildFocusedParams();
      sp.set("listOptions", "1");
      const res = await fetch(`/api/admin/reports/achievement-participation/focused?${sp.toString()}`, {
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
      const j = (await res.json()) as FocusedActivityOptionsPayload & { error?: string };
      if (!res.ok || !j.ok) {
        throw new Error(typeof (j as { error?: string }).error === "string" ? (j as { error: string }).error : "Request failed");
      }
      setFocusedActivityOptions(j.activityOptions);
      setFocusedError(null);
    } catch (e) {
      setFocusedError(e instanceof Error ? e.message : "Error");
      setFocusedActivityOptions([]);
    } finally {
      setFocusedOptionsLoading(false);
    }
  }, [buildFocusedParams, router]);

  const fetchFocusedReport = useCallback(async () => {
    if (!focusedPick) {
      setFocusedData(null);
      return;
    }
    const sep = focusedPick.indexOf("\u001f");
    const focusType = sep === -1 ? focusedPick : focusedPick.slice(0, sep);
    const focusRaw = sep === -1 ? "" : focusedPick.slice(sep + 1);
    setFocusedLoading(true);
    try {
      const sp = buildFocusedParams();
      sp.set("focusType", focusType);
      sp.set("focusRaw", focusRaw);
      sp.set("focusedOutcome", focusedOutcome);
      sp.set("page", String(focusedPage));
      sp.set("pageSize", "25");
      const res = await fetch(`/api/admin/reports/achievement-participation/focused?${sp.toString()}`, {
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
      const j = (await res.json()) as FocusedActivityReportPayload & { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        throw new Error(typeof j.error === "string" ? j.error : "Request failed");
      }
      setFocusedData(j);
      setFocusedError(null);
    } catch (e) {
      setFocusedError(e instanceof Error ? e.message : "Error");
      setFocusedData(null);
    } finally {
      setFocusedLoading(false);
    }
  }, [buildFocusedParams, focusedPick, focusedOutcome, focusedPage, router]);

  const fetchCompareReport = useCallback(async () => {
    if (!compareEnabled || !comparePick) {
      setCompareData(null);
      setCompareError(null);
      return;
    }
    const sep = comparePick.indexOf("\u001f");
    const focusType = sep === -1 ? comparePick : comparePick.slice(0, sep);
    const focusRaw = sep === -1 ? "" : comparePick.slice(sep + 1);
    const sp = buildFocusedParams();
    sp.set("focusType", focusType);
    sp.set("focusRaw", focusRaw);
    sp.set("focusedOutcome", focusedOutcome);
    sp.set("page", "1");
    sp.set("pageSize", "25");
    const cacheKey = `ci-compare:v1:${sp.toString()}`;
    const tCache0 = typeof performance !== "undefined" ? performance.now() : Date.now();
    try {
      if (typeof sessionStorage !== "undefined") {
        const raw = sessionStorage.getItem(cacheKey);
        if (raw) {
          const parsed = JSON.parse(raw) as { ts?: number; payload?: FocusedActivityReportPayload };
          if (parsed.ts && Date.now() - parsed.ts < 120_000 && parsed.payload?.ok) {
            setCompareData(parsed.payload);
            setCompareError(null);
            const ms =
              typeof performance !== "undefined" ? Math.round(performance.now() - tCache0) : 0;
            lastCompareLatencyMsRef.current = ms;
            logCompareIntel({
              durationMs: ms,
              cacheHit: true,
              filterSummary: ciRedactLine(sp.toString()),
            });
            return;
          }
        }
      }
    } catch {
      /* ignore cache */
    }
    setCompareLoading(true);
    try {
      const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
      let lastErr: unknown;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await fetch(`/api/admin/reports/achievement-participation/focused?${sp.toString()}`, {
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
          const j = (await res.json()) as FocusedActivityReportPayload & { ok?: boolean; error?: string };
          if (!res.ok || !j.ok) {
            throw new Error(typeof j.error === "string" ? j.error : "Request failed");
          }
          setCompareData(j);
          setCompareError(null);
          try {
            if (typeof sessionStorage !== "undefined") {
              sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), payload: j }));
            }
          } catch {
            /* ignore */
          }
          const ms =
            typeof performance !== "undefined" ? Math.round(performance.now() - t0) : 0;
          lastCompareLatencyMsRef.current = ms;
          logCompareIntel({
            durationMs: ms,
            cacheHit: false,
            filterSummary: ciRedactLine(sp.toString()),
          });
          return;
        } catch (e) {
          lastErr = e;
          if (attempt === 0) {
            await new Promise((r) => setTimeout(r, 450));
          }
        }
      }
      setCompareError(lastErr instanceof Error ? lastErr.message : "Error");
      setCompareData(null);
      logCompareIntel({
        durationMs: typeof performance !== "undefined" ? Math.round(performance.now() - t0) : 0,
        cacheHit: false,
        filterSummary: ciRedactLine(`${sp.toString()}|failed`),
      });
    } finally {
      setCompareLoading(false);
    }
  }, [buildFocusedParams, compareEnabled, comparePick, focusedOutcome, router]);

  const fetchStudentIntelligence = useCallback(async () => {
    setStudentIntelLoading(true);
    setStudentIntelError(null);
    try {
      const sp = buildFocusedParams();
      const res = await fetch(`/api/admin/reports/achievement-participation/student-intelligence?${sp.toString()}`, {
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
      const j = (await res.json()) as StudentIntelligencePayload & { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        throw new Error(typeof (j as { error?: string }).error === "string" ? (j as { error: string }).error : "Request failed");
      }
      setStudentIntelData(j);
    } catch (e) {
      setStudentIntelError(e instanceof Error ? e.message : "Error");
      setStudentIntelData(null);
    } finally {
      setStudentIntelLoading(false);
    }
  }, [buildFocusedParams, router]);

  useEffect(() => {
    if (allowed !== true || activeTab !== "general") return;
    void fetchData();
  }, [allowed, activeTab, fetchData]);

  useEffect(() => {
    if (allowed !== true || activeTab !== "focused") return;
    void fetchFocusedOptions();
  }, [allowed, activeTab, fetchFocusedOptions]);

  useEffect(() => {
    if (allowed !== true || activeTab !== "focused") return;
    void fetchFocusedReport();
  }, [allowed, activeTab, fetchFocusedReport]);

  useEffect(() => {
    if (allowed !== true || activeTab !== "focused") {
      return;
    }
    if (!compareEnabled || !comparePick) {
      setCompareData(null);
      setCompareError(null);
      return;
    }
    void fetchCompareReport();
  }, [allowed, activeTab, compareEnabled, comparePick, fetchCompareReport]);

  useEffect(() => {
    if (allowed !== true || activeTab !== "studentIntel") return;
    void fetchStudentIntelligence();
  }, [allowed, activeTab, fetchStudentIntelligence, f]);

  useEffect(() => {
    if (!data?.ok || (data.table?.length ?? 0) > 0) return;
    logEmptyDatasetIntel({
      surface: "participation_general",
      reasonCodes: ["zero_table_page"],
      filterSummary: ciRedactLine(
        JSON.stringify({ ay: f.academicYear, st: f.stage, tt: data.tableTotal })
      ),
    });
  }, [data?.ok, data?.table?.length, data?.tableTotal, f.academicYear, f.stage]);

  const title = isAr ? "منصة ذكاء المسابقات والبرامج — مدارس الأنجال" : "Competition Intelligence Platform — Al-Anjal Schools";

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
    return lines;
  }, [kpi, isAr]);

  const reportTitle = title;

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

  const focusedOutcomeOptions = useMemo(() => {
    const rows: { value: (typeof FOCUSED_ACHIEVEMENT_OUTCOMES)[number]; label: string }[] = [
      { value: "all", label: isAr ? "جميع النتائج" : "All outcomes" },
      { value: "medal_gold", label: isAr ? "ميدالية ذهبية" : "Gold medal" },
      { value: "medal_silver", label: isAr ? "ميدالية فضية" : "Silver medal" },
      { value: "medal_bronze", label: isAr ? "ميدالية برونزية" : "Bronze medal" },
      { value: "rank_first", label: isAr ? "المركز الأول" : "First place" },
      { value: "rank_second", label: isAr ? "المركز الثاني" : "Second place" },
      { value: "rank_third", label: isAr ? "المركز الثالث" : "Third place" },
      { value: "nomination", label: isAr ? "ترشيح" : "Nomination" },
      { value: "participation", label: isAr ? "مشاركة فقط" : "Participation only" },
      { value: "completion", label: isAr ? "اجتياز" : "Completion" },
      { value: "score", label: isAr ? "درجة" : "Score" },
      { value: "recognition", label: isAr ? "تكريم" : "Recognition" },
      { value: "special_award", label: isAr ? "جائزة خاصة" : "Special award" },
    ];
    return rows;
  }, [isAr]);

  useEffect(() => {
    setFocusedPage(1);
  }, [f, focusedOutcome, focusedPick]);

  const focusedParticipantHeaders = useMemo(
    () =>
      isAr
        ? [
            "اسم الطالب",
            "الجنس",
            "القسم",
            "موهبة",
            "الصف",
            "المرحلة",
            "المدرسة",
            "النشاط",
            "السنة",
            "النتيجة",
            "المستوى",
            "الدرجة",
            "الاعتماد",
          ]
        : [
            "Student",
            "Gender",
            "Section",
            "Mawhiba",
            "Grade",
            "Stage",
            "School",
            "Activity",
            "Year",
            "Result",
            "Level",
            "Score",
            "Approval",
          ],
    [isAr]
  );

  const focusedTableRows = useMemo(() => {
    if (!focusedData?.participants.length) return [];
    return focusedData.participants.map((r) => {
      const base: Record<string, string | number> = isAr
        ? {
            "اسم الطالب": r.studentNameAr,
            الجنس: r.gender === "female" ? "بنات" : "بنين",
            القسم: r.section === "international" ? "دولي" : "عربي",
            موهبة: r.mawhiba ? "موهبة" : "غير موهبة",
            الصف: r.gradeLabelAr,
            المرحلة: r.stageLabelAr,
            المدرسة: r.schoolOrOrganization,
            النشاط: r.activityLabelAr,
            السنة: r.year ?? "—",
            النتيجة: r.resultLineAr,
            المستوى: r.levelLabelAr,
            الدرجة: r.scoreOrValueDisplay,
            الاعتماد: r.approvalLabelAr,
          }
        : {
            Student: r.studentNameEn,
            Gender: r.gender === "female" ? "Female" : "Male",
            Section: r.section === "international" ? "International" : "Arabic",
            Mawhiba: r.mawhiba ? "Mawhiba" : "Non‑Mawhiba",
            Grade: r.gradeLabelEn,
            Stage: r.stageLabelEn,
            School: r.schoolOrOrganization,
            Activity: r.activityLabelEn,
            Year: r.year ?? "—",
            Result: r.resultLineEn,
            Level: r.levelLabelEn,
            Score: r.scoreOrValueDisplay,
            Approval: r.approvalLabelEn,
          };
      return base;
    });
  }, [focusedData, isAr]);

  const handleFocusedRefresh = useCallback(() => {
    void fetchFocusedOptions();
    void fetchFocusedReport();
    if (compareEnabled && comparePick) void fetchCompareReport();
    if (activeTab === "studentIntel") void fetchStudentIntelligence();
  }, [fetchFocusedOptions, fetchFocusedReport, fetchCompareReport, compareEnabled, comparePick, activeTab, fetchStudentIntelligence]);

  const handleFocusedExportSelectionExcel = (headers: string[], rows: Record<string, string | number>[]) => {
    void exportRowsToExcelWorkbook(
      rows,
      headers,
      isAr
        ? `مشاركون محددون — ${focusedData?.activityLabelAr ?? ""}`
        : `Selected participants — ${focusedData?.activityLabelEn ?? ""}`,
      "focused-activity-selected-rows",
      { rtlSheet: isAr }
    );
  };

  const handleFocusedExportSelectionPdf = (headers: string[], rows: Record<string, string | number>[]) => {
    void exportFocusedParticipantSelectionPdf({
      isAr,
      docTitle: isAr ? "مشاركون محددون" : "Selected participants",
      subtitle: focusedData
        ? `${isAr ? focusedData.activityLabelAr : focusedData.activityLabelEn} · ${isAr ? "العام الدراسي" : "Academic year"}: ${f.academicYear}`
        : undefined,
      note: isAr ? `عدد السجلات: ${rows.length}` : `Records: ${rows.length}`,
      headers,
      rows,
    });
  };

  const handleFocusedExcel = () =>
    void exportRowsToExcelWorkbook(
      focusedTableRows,
      focusedParticipantHeaders,
      isAr
        ? `تحليل نشاط — ${focusedData?.activityLabelAr ?? ""}`
        : `Focused activity — ${focusedData?.activityLabelEn ?? ""}`,
      "focused-activity-analytics",
      { rtlSheet: isAr }
    );

  const handleApplySavedExecutiveView = useCallback(
    (id: string) => {
      const view = savedExecutiveViews.find((v) => v.id === id);
      if (!view) return;
      hydrateLocalStoragePanelsFromSnapshot(view.snapshot);
      setF(mergeExecutiveSnapshotIntoFilter(view.snapshot));
      if (typeof view.snapshot.focusedPick === "string") setFocusedPick(view.snapshot.focusedPick);
      if (typeof view.snapshot.comparePick === "string") setComparePick(view.snapshot.comparePick);
      if (typeof view.snapshot.compareEnabled === "boolean") setCompareEnabled(view.snapshot.compareEnabled);
      if (typeof view.snapshot.focusedOutcome === "string") setFocusedOutcome(view.snapshot.focusedOutcome);
      const pr = view.snapshot.pdfPreset;
      if (pr && (Object.keys(CI_PDF_PRESET_LABELS) as CiPdfExportPreset[]).includes(pr)) {
        setPdfPreset(pr);
        try {
          localStorage.setItem(CI_STORAGE_KEYS.pdfPreset, pr);
        } catch {
          /* ignore */
        }
      }
    },
    [savedExecutiveViews]
  );

  const handleFocusedPdf = async (opts?: { retry?: boolean }) => {
    if (!intelAccess.executive_reports || !intelAccess.export_reports) return;
    if (!focusedPick || !focusedData) return;
    if (!opts?.retry) exportAttemptRef.current = 1;
    else exportAttemptRef.current += 1;
    const correlationId = createCorrelationId();
    setExportOverlayOpen(true);
    setExportState({
      phase: "idle",
      messageAr: "",
      messageEn: "",
      attempt: exportAttemptRef.current,
      correlationId,
    });
    const metaPdf: ExecutivePdfMetadata = {
      generatedAtIso: new Date().toISOString(),
      generatedBy: userExportLabel || undefined,
      filtersSummary: ciBuildFiltersSummary(f, isAr),
      activityFocus: isAr ? focusedData.activityLabelAr : focusedData.activityLabelEn,
      reportPreset: isAr ? CI_PDF_PRESET_LABELS[pdfPreset].ar : CI_PDF_PRESET_LABELS[pdfPreset].en,
      confidentiality: isAr ? "داخلي — للاستخدام المؤسسي" : "Internal — institutional use",
      correlationId,
      aggregationVersion: CI_AGGREGATION_VERSION,
      trustStatus: analyticsTrustReport.level,
    };
    const sep = focusedPick.indexOf("\u001f");
    const focusType = sep === -1 ? focusedPick : focusedPick.slice(0, sep);
    const focusRaw = sep === -1 ? "" : focusedPick.slice(sep + 1);

    const auditCtx = { rowCount: 0, activity: "" as string };
    const exportStartedMs = Date.now();

    const res = await runCompetitionExecutiveExport({
      isAr,
      initialAttempt: exportAttemptRef.current,
      correlationId,
      onUpdate: setExportState,
      safetyContext: {
        requestedRows: CI_EXPORT_PARTICIPANT_ROW_CAP,
        requestedCharts: 8,
        pdfSections: ["executive", "charts", "participants", "metadata"],
        attempt: exportAttemptRef.current,
      },
      run: async () => {
        const sp = buildFocusedParams();
        sp.set("focusType", focusType);
        sp.set("focusRaw", focusRaw);
        sp.set("focusedOutcome", focusedOutcome);
        sp.set("exportParticipants", "1");
        sp.set("exportMax", String(CI_EXPORT_PARTICIPANT_ROW_CAP));
        const fetchRes = await fetch(`/api/admin/reports/achievement-participation/focused?${sp.toString()}`, {
          cache: "no-store",
          credentials: "include",
        });
        if (!fetchRes.ok) {
          throw new Error(isAr ? "فشل جلب بيانات التصدير" : "Could not load export participants");
        }
        const exportPayload = (await fetchRes.json()) as FocusedActivityReportPayload;
        if (!exportPayload.ok) {
          throw new Error(isAr ? "استجابة التصدير غير صالحة" : "Invalid export payload");
        }
        auditCtx.rowCount = exportPayload.participants.length;
        auditCtx.activity = isAr ? focusedData.activityLabelAr : focusedData.activityLabelEn;
        const wa = exportPhaseMessages("waiting_assets", isAr);
        setExportState((prev) => ({
          ...prev,
          phase: "waiting_assets",
          messageAr: wa.ar,
          messageEn: wa.en,
          attempt: prev.attempt,
        }));
        const rowsForPdf = exportPayload.participants.map((r) => {
          const o: Record<string, string | number> = {};
          const h = focusedParticipantHeaders;
          if (isAr) {
            o[h[0]!] = r.studentNameAr;
            o[h[1]!] = r.gender === "female" ? "بنات" : "بنين";
            o[h[2]!] = r.section === "international" ? "دولي" : "عربي";
            o[h[3]!] = r.mawhiba ? "موهبة" : "غير موهبة";
            o[h[4]!] = r.gradeLabelAr;
            o[h[5]!] = r.stageLabelAr;
            o[h[6]!] = r.schoolOrOrganization;
            o[h[7]!] = r.activityLabelAr;
            o[h[8]!] = r.year ?? "—";
            o[h[9]!] = r.resultLineAr;
            o[h[10]!] = r.levelLabelAr;
            o[h[11]!] = r.scoreOrValueDisplay;
            o[h[12]!] = r.approvalLabelAr;
          } else {
            o[h[0]!] = r.studentNameEn;
            o[h[1]!] = r.gender === "female" ? "Female" : "Male";
            o[h[2]!] = r.section === "international" ? "International" : "Arabic";
            o[h[3]!] = r.mawhiba ? "Mawhiba" : "Non‑Mawhiba";
            o[h[4]!] = r.gradeLabelEn;
            o[h[5]!] = r.stageLabelEn;
            o[h[6]!] = r.schoolOrOrganization;
            o[h[7]!] = r.activityLabelEn;
            o[h[8]!] = r.year ?? "—";
            o[h[9]!] = r.resultLineEn;
            o[h[10]!] = r.levelLabelEn;
            o[h[11]!] = r.scoreOrValueDisplay;
            o[h[12]!] = r.approvalLabelEn;
          }
          return o;
        });
        const capNote =
          exportPayload.participants.length < exportPayload.totalParticipants
            ? isAr
              ? `يُعرض في الجدول أول ${exportPayload.participants.length} سجل من أصل ${exportPayload.totalParticipants}. صغّر نطاق الفلاتر أو نزّل Excel لصفحات إضافية.`
              : `Table shows first ${exportPayload.participants.length} of ${exportPayload.totalParticipants} records. Narrow filters or use Excel for full extracts.`
            : undefined;

        const dp = focusedData.decisionPlatform;
        if (dp) {
          await exportFocusedExecutiveReportPdf(
            {
              isAr,
              docTitle: isAr ? "تقرير تنفيذي — منصة الذكاء" : "Executive intelligence report",
              activityTitle: isAr ? focusedData.activityLabelAr : focusedData.activityLabelEn,
              academicYearLine: `${isAr ? "العام الدراسي" : "Academic year"}: ${f.academicYear}`,
              outcomeLine: `${isAr ? "نوع الإنجاز" : "Outcome"}: ${focusedOutcomeOptions.find((x) => x.value === focusedOutcome)?.label ?? focusedOutcome}`,
              narrativeAr: dp.narrativeAr,
              narrativeEn: dp.narrativeEn,
              alerts: dp.alerts.map((a) => ({
                icon: a.icon,
                title: isAr ? a.titleAr : a.titleEn,
                detail: isAr ? a.detailAr : a.detailEn,
              })),
              recommendations: dp.recommendations.map((r) => ({
                text: isAr ? r.textAr : r.textEn,
              })),
              kpis: focusedData.executive.kpiCards.map((c) => ({
                label: isAr ? c.labelAr : c.labelEn,
                value: c.value,
              })),
              medalRows: dp.medalIntelligence.bars.map((b) => ({
                label: isAr ? b.labelAr : b.labelEn,
                rate: String(b.rate),
              })),
              benchmarkRows: dp.benchmarkIntelligence.rows.map((row) => ({
                label: isAr ? row.dimensionAr : row.dimensionEn,
                left: isAr ? row.leftLabelAr : row.leftLabelEn,
                right: isAr ? row.rightLabelAr : row.rightLabelEn,
                leftPct: String(row.leftPct),
                rightPct: String(row.rightPct),
              })),
              rankingRows: dp.activityRanking.topByExcellence.slice(0, 15).map((r, i) => ({
                rank: i + 1,
                label: isAr ? r.labelAr : r.labelEn,
                excellence: `${r.excellenceRatePct}%`,
                medalsPer100: String(ciMedalsPer100(r.totalMedals, r.records)),
              })),
              charts: {
                resultBars: focusedData.charts.resultBars.map((b) => ({
                  label: isAr ? b.labelAr : b.labelEn,
                  count: b.count,
                })),
                genderSlices: focusedData.charts.genderPie.map((s) => ({
                  label: isAr ? s.nameAr : s.nameEn,
                  value: s.value,
                })),
                sectionSlices: focusedData.charts.sectionPie.map((s) => ({
                  label: isAr ? s.nameAr : s.nameEn,
                  value: s.value,
                })),
                mawhibaSlices: focusedData.charts.mawhibaPie.map((s) => ({
                  label: isAr ? s.nameAr : s.nameEn,
                  value: s.value,
                })),
                yearTrend: focusedData.charts.yearTrend.map((y) => ({
                  year: y.year,
                  records: y.records,
                  distinctStudents: y.distinctStudents,
                  goldMedals: y.goldMedals,
                  excellenceRatePct: y.excellenceRatePct,
                })),
              },
              participantHeaders: focusedParticipantHeaders,
              participantRows: rowsForPdf,
              capNote,
              preset: pdfPreset,
              studentIntelRows: studentIntelData?.byMedals?.length
                ? studentIntelData.byMedals.slice(0, 24).map((row) => ({
                    name: isAr ? row.nameAr : row.nameEn,
                    rec: String(row.recordCount),
                    medals: String(row.medalCount),
                    stage: isAr ? row.stageLabelAr : row.stageLabelEn,
                  }))
                : undefined,
              metadata: metaPdf,
            },
            "/report-header.png"
          );
          return;
        }

        const esc = (t: string) =>
          t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
        let appendHtml: string | undefined;
        const yc = focusedData.executive?.yearComparison ?? [];
        if (yc.length > 0) {
          const thYear = esc(isAr ? "السنة" : "Year");
          const thSt = esc(isAr ? "طلاب" : "Students");
          const thMed = esc(isAr ? "ميداليات" : "Medals");
          const thEx = esc(isAr ? "تميز %" : "Excellence %");
          const thTop = esc(isAr ? "أعلى مستوى" : "Top level");
          const rows = yc
            .map(
              (y) =>
                `<tr><td class="num">${y.year}</td><td class="num">${y.distinctStudents}</td><td class="num">${y.totalMedals}</td><td class="num">${y.excellenceRatePct}%</td><td dir="auto">${esc(
                  isAr ? y.topLevelLabelAr : y.topLevelLabelEn
                )}</td></tr>`
            )
            .join("");
          appendHtml = `<div class="exec-append"><h2>${esc(isAr ? "مقارنة سنوية (تنفيذي)" : "Year-over-year (executive)")}</h2><table class="mini"><thead><tr><th>${thYear}</th><th>${thSt}</th><th>${thMed}</th><th>${thEx}</th><th>${thTop}</th></tr></thead><tbody>${rows}</tbody></table></div>`;
        }

        await exportFocusedCompetitionAnalyticsPdf(
          {
            isAr,
            docTitle: isAr ? "تقرير نشاط محدد" : "Focused activity report",
            activityTitle: isAr ? focusedData.activityLabelAr : focusedData.activityLabelEn,
            academicYearLine: `${isAr ? "العام الدراسي" : "Academic year"}: ${f.academicYear}`,
            outcomeLine: `${isAr ? "نوع الإنجاز" : "Outcome"}: ${focusedOutcomeOptions.find((x) => x.value === focusedOutcome)?.label ?? focusedOutcome}`,
            kpis: [
              { label: isAr ? "إجمالي السجلات" : "Total records", value: String(focusedData.kpis.totalRecords) },
              { label: isAr ? "طلاب فريدون" : "Distinct students", value: String(focusedData.kpis.distinctStudents) },
              { label: isAr ? "معتمد" : "Approved", value: String(focusedData.kpis.approvedRecords) },
              { label: isAr ? "نسبة التميز %" : "Excellence %", value: `${focusedData.kpis.excellenceRatePct}%` },
            ],
            charts: {
              resultBars: focusedData.charts.resultBars.map((b) => ({
                label: isAr ? b.labelAr : b.labelEn,
                count: b.count,
              })),
              genderSlices: focusedData.charts.genderPie.map((s) => ({
                label: isAr ? s.nameAr : s.nameEn,
                value: s.value,
              })),
              sectionSlices: focusedData.charts.sectionPie.map((s) => ({
                label: isAr ? s.nameAr : s.nameEn,
                value: s.value,
              })),
              mawhibaSlices: focusedData.charts.mawhibaPie.map((s) => ({
                label: isAr ? s.nameAr : s.nameEn,
                value: s.value,
              })),
              yearTrend: focusedData.charts.yearTrend,
            },
            participantHeaders: focusedParticipantHeaders,
            participantRows: rowsForPdf,
            capNote,
            appendHtml,
            metadata: metaPdf,
          },
          "/report-header.png"
        );
      },
    });
    const digest = ciRedactLine(
      JSON.stringify({
        ay: f.academicYear,
        st: f.stage,
        oc: focusedOutcome,
        ft: focusType,
      })
    );
    const cacheAge =
      focusedData?.ciObservability?.cacheAgeMs ?? data?.ciObservability?.cacheAgeMs;
    appendCiExportAudit({
      ts: new Date().toISOString(),
      status: res.ok ? "success" : "failure",
      durationMs: Date.now() - exportStartedMs,
      preset: pdfPreset,
      exportPreset: pdfPreset,
      rowCount: auditCtx.rowCount,
      activityFocus: auditCtx.activity,
      compareMode: compareEnabled,
      compareTargets:
        compareEnabled && comparePick ?
          [focusedPick, comparePick].filter(Boolean)
        : undefined,
      filtersDigest: digest,
      filtersSnapshot: digest,
      correlationId,
      exportStatus: res.ok ? "success" : "failure",
      retryCount: exportAttemptRef.current,
      cacheAge,
      trustStatus: analyticsTrustReport.level,
      degradedExport: res.degraded,
      diagnosticsSummary: buildDiagnosticsSummary({
        trust: analyticsTrustReport.level,
        agg: CI_AGGREGATION_VERSION,
        degraded: res.degraded,
        compare: compareEnabled,
      }),
    });
    if (metaPdf.degradedExport !== res.degraded) {
      metaPdf.degradedExport = res.degraded;
    }
    competitionIntelDebug("focused pdf export", res);
    if (res.ok) {
      window.setTimeout(() => setExportOverlayOpen(false), 1800);
    }
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.tableTotal / data.pageSize)) : 1;
  const focusedTotalPages = focusedData
    ? Math.max(1, Math.ceil(focusedData.totalParticipants / focusedData.pageSize))
    : 1;

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
        {dataDegraded && activeTab === "general" ? (
          <div
            role="status"
            className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          >
            {isAr ?
              "يتم عرض بيانات مؤقتة أو مخزّنة مسبقًا بسبب ضغط على الخادم. اضغط «تحديث» لإعادة الجلب."
            : "Showing cached or snapshot data due to server load. Use Refresh to fetch live data."}
          </div>
        ) : null}
        <PageHeader
          title={title}
          subtitle={
            isAr
              ? "قراءة تنفيذية، مقارنات، تنبيهات قواعدية، وتصدير PDF متعدد الأقسام — دون المساس ببقية النظام."
              : "Executive reading, comparisons, rule-based alerts, and multi-section PDF export — without altering the rest of the system."
          }
          actions={
            <div className="flex flex-wrap items-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (activeTab === "general") void fetchData();
                  else if (activeTab === "focused") handleFocusedRefresh();
                  else void fetchStudentIntelligence();
                }}
                disabled={
                  activeTab === "general"
                    ? loading
                    : activeTab === "focused"
                      ? focusedLoading || focusedOptionsLoading
                      : studentIntelLoading
                }
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-text shadow-sm hover:bg-gray-50 disabled:opacity-50"
              >
                {activeTab === "general" && loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : activeTab === "focused" && (focusedLoading || focusedOptionsLoading) ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : activeTab === "studentIntel" && studentIntelLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {isAr ? "تحديث" : "Refresh"}
              </button>
              {activeTab === "focused" ? (
                <>
                  <label className="flex flex-col gap-1 text-xs font-semibold text-slate-700">
                    <span>{isAr ? "قالب PDF" : "PDF preset"}</span>
                    <select
                      value={pdfPreset}
                      onChange={(e) => {
                        const v = e.target.value as CiPdfExportPreset;
                        setPdfPreset(v);
                        try {
                          localStorage.setItem(CI_STORAGE_KEYS.pdfPreset, v);
                        } catch {
                          /* ignore */
                        }
                      }}
                      className="min-w-[10rem] rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-900"
                      aria-label={isAr ? "قالب التصدير التنفيذي" : "Executive export preset"}
                    >
                      {(Object.keys(CI_PDF_PRESET_LABELS) as CiPdfExportPreset[]).map((k) => (
                        <option key={k} value={k}>
                          {isAr ? CI_PDF_PRESET_LABELS[k].ar : CI_PDF_PRESET_LABELS[k].en}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-semibold text-slate-700">
                    <span>{isAr ? "عرض محفوظ" : "Saved view"}</span>
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) return;
                        handleApplySavedExecutiveView(v);
                        e.currentTarget.value = "";
                      }}
                      className="min-w-[9rem] rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-900"
                      aria-label={isAr ? "تحميل عرض تنفيذي محفوظ" : "Load saved executive view"}
                    >
                      <option value="">{isAr ? "— تحميل —" : "— Load —"}</option>
                      {savedExecutiveViews.map((sv) => (
                        <option key={sv.id} value={sv.id}>
                          {isAr ? sv.nameAr : sv.nameEn}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const name = window.prompt(isAr ? "اسم العرض المحفوظ" : "Saved view name");
                      if (!name?.trim()) return;
                      const snapshot: ExecutiveUiSnapshot = {
                        v: 1,
                        focusedPick,
                        comparePick,
                        compareEnabled,
                        pdfPreset,
                        focusedOutcome,
                        filter: cloneExecutiveFilterSnapshot(f),
                        ...captureExecutiveAuxLocalState(),
                      };
                      upsertSavedExecutiveView({
                        id: `sv_${Date.now()}`,
                        nameAr: name.trim(),
                        nameEn: name.trim(),
                        snapshot,
                      });
                      setSavedExecutiveViews(readSavedExecutiveViews());
                    }}
                    className="self-end rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-900 hover:bg-indigo-100"
                  >
                    {isAr ? "حفظ العرض" : "Save view"}
                  </button>
                </>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  if (activeTab === "general") handlePdf();
                  else if (activeTab === "focused") void handleFocusedPdf();
                }}
                disabled={
                  (activeTab === "focused" &&
                    (!focusedData || !focusedPick || !intelAccess.export_reports)) ||
                  activeTab === "studentIntel"
                }
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-text shadow-sm hover:bg-gray-50 disabled:opacity-40"
              >
                PDF
              </button>
              <button
                type="button"
                onClick={() => {
                  if (activeTab === "general") handleExcel();
                  else if (activeTab === "focused") handleFocusedExcel();
                }}
                disabled={
                  (activeTab === "focused" && focusedTableRows.length === 0) || activeTab === "studentIntel"
                }
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-text shadow-sm hover:bg-gray-50 disabled:opacity-40"
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

        {allowed === true ? (
          <div
            className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-sm print:hidden"
            role="status"
            aria-label={isAr ? "حالة ثقة التحليلات" : "Analytics trust status"}
          >
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                analyticsTrustReport.level === "synced" ? "bg-emerald-500"
                : analyticsTrustReport.level === "partial" ? "bg-amber-400"
                : "bg-red-600"
              }`}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black text-slate-900">
                {isAr ? "ثقة التحليلات" : "Analytics trust"}
              </p>
              <p className="text-[11px] leading-snug text-slate-600">
                {analyticsTrustReport.level === "synced" &&
                  (isAr ? "البيانات متزامنة بين اللوحات لهذه الجلسة." : "Data is consistent across panels for this session.")}
                {analyticsTrustReport.level === "partial" &&
                  (isAr ? "بعض المقارنات تقريبية أو بحاجة لمراجعة الفلاتر." : "Some comparisons are approximate — review filters if unsure.")}
                {analyticsTrustReport.level === "mismatch" &&
                  (isAr ? "تم رصد اختلاف — راجع وحدة البيانات أو أعد التحميل." : "Mismatch detected — refresh or review underlying data.")}
              </p>
              {isCompetitionIntelDebugEnabled() && analyticsTrustReport.issues.length ? (
                <p className="mt-1 break-all font-mono text-[10px] text-slate-500" dir="ltr">
                  {analyticsTrustReport.issues.slice(0, 6).join(" · ")}
                </p>
              ) : null}
            </div>
            {cacheAgeLabel ? (
              <span className="text-[11px] font-semibold text-slate-500">{cacheAgeLabel}</span>
            ) : null}
          </div>
        ) : null}

        <div className="mb-4 flex flex-wrap gap-3 text-sm print:hidden">
          <Link href="/admin/achievements/reports" className="font-semibold text-primary hover:underline">
            {isAr ? "← تقارير الإنجازات التفصيلية" : "← Detailed achievement reports"}
          </Link>
          <Link href="/admin/analytics" className="font-semibold text-primary hover:underline">
            {isAr ? "الإحصاءات المتقدمة" : "Advanced analytics"}
          </Link>
        </div>

        <div
          className="mb-4 flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-2 print:hidden"
          role="tablist"
          aria-label={isAr ? "نوع التقرير" : "Report mode"}
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "general"}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
              activeTab === "general"
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                : "text-slate-600 hover:bg-white/70"
            }`}
            onClick={() => {
              setActiveTab("general");
              setPage(1);
            }}
          >
            {isAr ? "الإحصائيات العامة" : "General analytics"}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "focused"}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
              activeTab === "focused"
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-indigo-200"
                : "text-slate-600 hover:bg-white/70"
            }`}
            onClick={() => {
              setActiveTab("focused");
              setFocusedPage(1);
            }}
          >
            {isAr ? "قرار المسابقات" : "Competition decision"}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "studentIntel"}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
              activeTab === "studentIntel"
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-teal-200"
                : "text-slate-600 hover:bg-white/70"
            }`}
            onClick={() => {
              setActiveTab("studentIntel");
            }}
          >
            {isAr ? "تميّز الطلاب" : "Student distinction"}
          </button>
        </div>

        <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 print:hidden">
          <h2 className="text-sm font-black text-slate-900">{isAr ? "الفلاتر" : "Filters"}</h2>
          <p className="mt-1 text-xs text-slate-500">
            {activeTab === "general"
              ? isAr
                ? "نطاق عام لجميع الأنشطة ضمن الفلاتر. للتقرير التفصيلي لمسابقة واحدة استخدم تبويب قرار المسابقات."
                : "Broad analytics for all activities under the filters. Use the competition decision tab for a single activity drill-down."
              : activeTab === "focused"
                ? isAr
                  ? "اضبط الفلاتر أدناه، ثم استخدم لوحة الذكاء لاختيار النشاط والمقارنة والتصدير التنفيذي."
                  : "Set filters below, then use the intelligence panel for activity selection, comparison, and executive export."
                : isAr
                  ? "نفس فلاتر النطاق العام لعرض أكثر الطلاب تميزًا حسب المشاركة، الميداليات، معدل النجاح، وتنوع الأنشطة."
                  : "Same global filters to rank students by participation, medals, success rate, and activity diversity."}
          </p>
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

        {activeTab === "studentIntel" && studentIntelError ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{studentIntelError}</div>
        ) : null}

        {activeTab === "general" && error ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
        ) : null}

        {activeTab === "focused" && focusedError ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{focusedError}</div>
        ) : null}

        {activeTab === "focused" && compareError ? (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">{compareError}</div>
        ) : null}

        {activeTab === "studentIntel" && allowed === true && !studentIntelData && studentIntelLoading ? (
          <div className="flex items-center gap-2 py-12 text-slate-600">
            <Loader2 className="h-5 w-5 animate-spin" />
            {isAr ? "جاري تحميل تميّز الطلاب…" : "Loading student intelligence…"}
          </div>
        ) : null}

        {activeTab === "studentIntel" && studentIntelData ? (
          <section className="mb-6 space-y-6 print:hidden" dir={isAr ? "rtl" : "ltr"}>
            <div className="rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50/50 to-white p-4 shadow-sm ring-1 ring-teal-100/60">
              <h2 className="text-sm font-black text-teal-950">
                {isAr ? "تميّز الطلاب ضمن الفلاتر الحالية" : "Student distinction under current filters"}
              </h2>
              <p className="mt-1 text-xs text-teal-900/80">
                {isAr
                  ? "قوائم حتمية من الخادم — صورة، مرحلة، قسم، موهبة، وإجمالي الإنجازات."
                  : "Server-driven lists — photo, stage, section, Mawhiba, and total achievement footprint."}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {(
                [
                  [isAr ? "أكثر المشاركة" : "Most participation", studentIntelData.byParticipation],
                  [isAr ? "أكثر الميداليات" : "Most medals", studentIntelData.byMedals],
                  [isAr ? "أعلى معدل نجاح (ميداليات/سجل)" : "Highest success rate (medals/record)", studentIntelData.bySuccessRate],
                  [isAr ? "أوسع تنوع أنشطة" : "Broadest activity mix", studentIntelData.byActivityDiversity],
                  [isAr ? "أسرع تطور (زخم سنوي)" : "Fastest growth (yearly momentum)", studentIntelData.byFastestGrowth],
                ] as const
              ).map(([label, list]) => (
                <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</h3>
                  <ul className="mt-3 space-y-2">
                    {list.length === 0 ? (
                      <li className="text-xs text-slate-500">{isAr ? "لا بيانات." : "No rows."}</li>
                    ) : (
                      list.slice(0, 10).map((row) => (
                        <li key={`${label}-${row.participantId}`} className="list-none">
                          <button
                            type="button"
                            className="flex w-full items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-2 text-start transition hover:border-indigo-200 hover:bg-indigo-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                            onClick={() => setStudentProfilePid(row.participantId)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setStudentProfilePid(row.participantId);
                              }
                            }}
                            aria-label={
                              isAr
                                ? `عرض ملف ${row.nameAr}`
                                : `Open profile for ${row.nameEn}`
                            }
                          >
                            {row.avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={row.avatarUrl}
                                alt=""
                                className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
                              />
                            ) : (
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-600">
                                {(isAr ? row.nameAr : row.nameEn).slice(0, 1)}
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-bold text-slate-900" dir="auto">
                                {isAr ? row.nameAr : row.nameEn}
                              </p>
                              <p className="mt-0.5 text-[11px] text-slate-600" dir="auto">
                                {isAr ? row.stageLabelAr : row.stageLabelEn} ·{" "}
                                {row.sectionKey === "international" ? (isAr ? "دولي" : "Intl.") : isAr ? "عربي" : "Arabic"}{" "}
                                · {row.mawhiba ? (isAr ? "موهبة" : "Mawhiba") : isAr ? "غير موهبة" : "Non‑Mawhiba"}
                              </p>
                              <p className="mt-1 text-[11px] font-semibold tabular-nums text-slate-800">
                                {isAr ? "سجلات" : "Rec"} {row.recordCount} · {isAr ? "ميداليات" : "Med"} {row.medalCount} ·{" "}
                                {isAr ? "أنشطة" : "Acts"} {row.distinctActivityCount} · {isAr ? "نسبة" : "Ratio"}{" "}
                                {row.medalRatioPct}%
                                {typeof row.growthIndex === "number" ? (
                                  <>
                                    {" "}
                                    · {isAr ? "زخم" : "Mom."} {row.growthIndex}
                                    {typeof row.yearSpan === "number" && row.yearSpan > 0
                                      ? ` /${row.yearSpan}${isAr ? "س" : "y"}`
                                      : ""}
                                  </>
                                ) : null}
                              </p>
                            </div>
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              ))}
            </div>

            {studentProfilePid ? (
              <div
                className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center print:hidden"
                role="dialog"
                aria-modal="true"
                aria-labelledby="student-profile-title"
              >
                <button
                  type="button"
                  className="absolute inset-0 bg-slate-900/40"
                  aria-label={isAr ? "إغلاق" : "Close"}
                  onClick={() => setStudentProfilePid(null)}
                />
                <div className="relative z-10 mb-0 max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:mb-0 sm:rounded-2xl">
                  <div className="flex items-start justify-between gap-2">
                    <h2 id="student-profile-title" className="text-sm font-black text-slate-900">
                      {isAr ? "ملف الطالب" : "Student profile"}
                    </h2>
                    <button
                      type="button"
                      className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50"
                      onClick={() => setStudentProfilePid(null)}
                    >
                      {isAr ? "إغلاق" : "Close"}
                    </button>
                  </div>
                  {studentProfileLoading ? (
                    <div className="mt-6 min-h-[14rem] space-y-3" aria-busy="true" aria-live="polite">
                      <div className="h-4 w-2/3 max-w-xs animate-pulse rounded bg-slate-200" />
                      <div className="space-y-2">
                        <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
                        <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
                        <div className="h-3 w-5/6 animate-pulse rounded bg-slate-100" />
                      </div>
                      <div className="h-24 w-full animate-pulse rounded-lg bg-slate-100" />
                      <p className="flex items-center gap-2 text-xs text-slate-500">
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                        {isAr ? "جاري التحميل…" : "Loading…"}
                      </p>
                    </div>
                  ) : studentProfileError ? (
                    <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                      {studentProfileError}
                      <button
                        type="button"
                        className="mt-2 block text-xs font-bold underline"
                        onClick={() => setStudentProfileReloadKey((k) => k + 1)}
                      >
                        {isAr ? "إعادة المحاولة" : "Retry"}
                      </button>
                    </div>
                  ) : studentProfileData ? (
                    <div className="mt-4 space-y-4 text-xs">
                      <div>
                        <p className="font-black text-slate-800">{isAr ? "التوزيع حسب النتيجة" : "By result type"}</p>
                        <ul className="mt-2 space-y-1">
                          {studentProfileData.byResult.length === 0 ? (
                            <li className="text-slate-500">{isAr ? "لا بيانات." : "No data."}</li>
                          ) : (
                            studentProfileData.byResult.map((r) => (
                              <li key={r.key} className="flex justify-between gap-2 tabular-nums">
                                <span className="text-slate-600">{r.key}</span>
                                <span className="font-bold">{r.count}</span>
                              </li>
                            ))
                          )}
                        </ul>
                      </div>
                      <div>
                        <p className="font-black text-slate-800">{isAr ? "التطور السنوي" : "Year progression"}</p>
                        <ul className="mt-2 space-y-1">
                          {studentProfileData.byYear.length === 0 ? (
                            <li className="text-slate-500">{isAr ? "لا بيانات." : "No data."}</li>
                          ) : (
                            studentProfileData.byYear.map((y) => (
                              <li key={y.year} className="flex justify-between gap-2 tabular-nums">
                                <span className="text-slate-600">{y.year}</span>
                                <span className="font-bold">{y.count}</span>
                              </li>
                            ))
                          )}
                        </ul>
                      </div>
                      <div>
                        <p className="font-black text-slate-800">{isAr ? "الخط الزمني (آخر السجلات)" : "Timeline (latest records)"}</p>
                        <ul className="mt-2 max-h-56 space-y-2 overflow-y-auto rounded-lg border border-slate-100 p-2">
                          {studentProfileData.timeline.length === 0 ? (
                            <li className="text-slate-500">{isAr ? "لا بيانات." : "No data."}</li>
                          ) : (
                            studentProfileData.timeline.map((t, idx) => (
                              <li key={`${t.sortDate}-${idx}`} className="border-b border-slate-100 pb-2 last:border-0">
                                <p className="font-semibold text-slate-900" dir="auto">
                                  {isAr ? t.labelAr : t.labelEn}
                                </p>
                                <p className="mt-0.5 text-[10px] text-slate-500">
                                  {t.year ?? "—"} · {t.resultType || "—"} · {t.achievementType || "—"}
                                </p>
                              </li>
                            ))
                          )}
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-4 text-xs text-slate-500">{isAr ? "لا بيانات." : "No data."}</p>
                  )}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {activeTab === "general" && allowed === true && !data && loading ? (
          <div className="flex items-center gap-2 py-12 text-slate-600">
            <Loader2 className="h-5 w-5 animate-spin" />
            {isAr ? "جاري التحميل…" : "Loading…"}
          </div>
        ) : null}

        {activeTab === "general" && data && kpi ? (
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

        {activeTab === "focused" ? (
          <FocusedExecutiveIntelligencePanel
            isAr={isAr}
            primaryType={f.primaryType}
            onPrimaryTypeChange={(v) => {
              setF((p) => ({ ...p, primaryType: v }));
              setFocusedPick("");
              setComparePick("");
            }}
            categoryOptions={categoryOptions}
            activityOptions={focusedActivityOptions}
            optionsLoading={focusedOptionsLoading}
            pick={focusedPick}
            onPickChange={setFocusedPick}
            compareEnabled={compareEnabled}
            onCompareEnabledChange={(v) => {
              setCompareEnabled(v);
              if (!v) {
                setComparePick("");
                setCompareData(null);
                setCompareError(null);
              }
            }}
            comparePick={comparePick}
            onComparePickChange={setComparePick}
            compareData={compareData}
            compareLoading={compareLoading}
            outcome={focusedOutcome}
            onOutcomeChange={setFocusedOutcome}
            outcomeOptions={focusedOutcomeOptions.map((o) => ({ value: String(o.value), label: o.label }))}
            data={focusedData}
            loading={focusedLoading}
            page={focusedPage}
            onPageChange={setFocusedPage}
            totalPages={focusedTotalPages}
            focusedParticipantHeaders={focusedParticipantHeaders}
            onExportSelectedExcel={handleFocusedExportSelectionExcel}
            onExportSelectedPdf={handleFocusedExportSelectionPdf}
            academicYearLine={isAr ? `العام الدراسي: ${f.academicYear}` : `Academic year: ${f.academicYear}`}
            outcomeLine={`${isAr ? "نوع الإنجاز" : "Outcome"}: ${
              focusedOutcomeOptions.find((x) => x.value === focusedOutcome)?.label ?? focusedOutcome
            }`}
            reportLoadError={focusedError}
            onRelaxReportFilters={() => {
              setF((p) => ({
                ...p,
                categories: [],
                levels: [],
                resultTokens: [],
                domain: "",
                organization: "",
                classification: "",
              }));
            }}
            filterContext={{
              academicYear: f.academicYear,
              stage: f.stage,
              outcome: focusedOutcome,
              primaryType: f.primaryType,
            }}
          />
        ) : null}
        {isCompetitionIntelDebugEnabled() ? (
          <section
            className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-xs text-slate-800 print:hidden"
            aria-label={isAr ? "تشخيص الموثوقية" : "Reliability diagnostics"}
          >
            <h3 className="text-sm font-black">{isAr ? "موثوقية التشغيل (debug)" : "Operational reliability (debug)"}</h3>
            <ul className="mt-2 list-inside list-disc space-y-1 text-[11px] leading-relaxed text-slate-600">
              <li dir="ltr">
                {isAr ? "عام:" : "General:"}{" "}
                {data?.ciObservability ?
                  `cacheHit=${String(data.ciObservability.cacheHit)} serverMs=${data.ciObservability.serverFacetMs}`
                : "—"}
              </li>
              <li dir="ltr">
                {isAr ? "مركّز:" : "Focused:"}{" "}
                {focusedData?.ciObservability ?
                  `cacheHit=${String(focusedData.ciObservability.cacheHit)} serverMs=${focusedData.ciObservability.serverFacetMs}`
                : "—"}
              </li>
              <li dir="ltr">
                {isAr ? "مقارنة آخر زمن:" : "Last compare ms:"}{" "}
                {lastCompareLatencyMsRef.current ?? "—"}
              </li>
            </ul>
            <p className="mt-2 text-[11px] text-slate-600" dir="ltr">
              governance={intelAccess.governance.mode} · agg=v{CI_AGGREGATION_VERSION}
            </p>
            <p className="mt-3 text-[11px] font-black text-slate-800">{isAr ? "سجل التصدير المحلي" : "Local export audit"}</p>
            <ul className="mt-1 space-y-1 font-mono text-[10px] text-slate-600" dir="ltr">
              {readCiExportAudit().slice(0, 5).map((e) => (
                <li key={`${e.ts}-${e.correlationId ?? "na"}`}>
                  {e.ts} · {e.exportStatus ?? e.status} · {e.durationMs}ms · agg={e.aggregationVersion ?? "-"} · trust=
                  {e.trustStatus ?? "-"} · rows={e.rowCount ?? 0}
                  {e.degradedExport ? " · degraded" : ""}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <CompetitionExportOverlay
          open={exportOverlayOpen}
          state={exportState}
          isAr={isAr}
          onDismiss={() => setExportOverlayOpen(false)}
          onRetry={() => void handleFocusedPdf({ retry: true })}
        />
      </div>
    </PageContainer>
  );
};

export default AdminParticipationAnalyticsPage;
