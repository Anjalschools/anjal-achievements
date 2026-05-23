"use client";

import {
  createContext,
  useCallback,
  useContext,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useRouter } from "next/navigation";
import { getLocale } from "@/lib/i18n";
import { resilientFetchJson } from "@/lib/client/resilient-fetch";
import {
  buildAnalyticsCanonicalSnapshot,
  type AnalyticsCanonicalSnapshot,
} from "@/lib/analytics/analytics-canonical-snapshot";
import {
  buildAnalyticsInsights,
  type AnalyticsInsightsBundle,
} from "@/lib/analytics/analytics-insights-engine";
import {
  runAnalyticsConsistencyEngine,
  formatCacheAgeLabel,
  type CiConsistencyReport,
} from "@/lib/competition-intelligence-consistency";
import { runStudentIntelGovernance } from "@/lib/competition/governance/student-intel-governance";
import { isCompetitionIntelDebugEnabled } from "@/lib/competition-intelligence-diagnostics";
import {
  getReportCategoryOptions,
  getReportLevelOptions,
  getReportResultOptions,
} from "@/lib/report-filter-options";
import {
  readExecutiveSnapshot,
  writeExecutiveSnapshot,
  hydrateLocalStoragePanelsFromSnapshot,
  captureExecutiveAuxLocalState,
  cloneExecutiveFilterSnapshot,
  mergeExecutiveSnapshotIntoFilter,
  type ExecutiveFilterSnapshot,
  type ExecutiveUiSnapshot,
} from "@/lib/competition-intelligence-persistence";
import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";
import type {
  FocusedActivityOptionsPayload,
  FocusedActivityReportPayload,
} from "@/types/focused-activity-report";
import type { StudentIntelligencePayload } from "@/lib/student-intelligence-analytics";
import type { CiPdfExportPreset } from "@/lib/competition-intelligence-theme";
import { CI_PDF_PRESET_LABELS, CI_STORAGE_KEYS } from "@/lib/competition-intelligence-theme";

export type AnalyticsTab = "general" | "focused" | "studentIntel";

export type AnalyticsFilterContextValue = {
  isAr: boolean;
  allowed: boolean | null;
  setAllowed: (v: boolean | null) => void;
  activeTab: AnalyticsTab;
  setActiveTab: (t: AnalyticsTab) => void;
  f: ExecutiveFilterSnapshot;
  setF: React.Dispatch<React.SetStateAction<ExecutiveFilterSnapshot>>;
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  focusedPage: number;
  setFocusedPage: React.Dispatch<React.SetStateAction<number>>;
  focusedOutcome: string;
  setFocusedOutcome: (v: string) => void;
  focusedPick: string;
  setFocusedPick: (v: string) => void;
  focusedActivityOptions: Array<{
    typeKey: string;
    rawKey: string;
    count: number;
    labelAr: string;
    labelEn: string;
  }>;
  compareEnabled: boolean;
  setCompareEnabled: (v: boolean) => void;
  comparePick: string;
  setComparePick: (v: string) => void;
  pdfPreset: CiPdfExportPreset;
  setPdfPreset: (v: CiPdfExportPreset) => void;
  data: ParticipationAnalyticsPayload | null;
  loading: boolean;
  error: string | null;
  dataDegraded: boolean;
  focusedData: FocusedActivityReportPayload | null;
  focusedLoading: boolean;
  focusedError: string | null;
  focusedOptionsLoading: boolean;
  compareData: FocusedActivityReportPayload | null;
  compareLoading: boolean;
  compareError: string | null;
  studentIntelData: StudentIntelligencePayload | null;
  studentIntelLoading: boolean;
  studentIntelError: string | null;
  categoryOptions: ReturnType<typeof getReportCategoryOptions>;
  levelOptions: ReturnType<typeof getReportLevelOptions>;
  resultOptions: ReturnType<typeof getReportResultOptions>;
  canonicalSnapshot: AnalyticsCanonicalSnapshot;
  insights: AnalyticsInsightsBundle;
  analyticsTrustReport: CiConsistencyReport;
  cacheAgeLabel: string | null;
  filterKey: string;
  refreshAll: () => void;
  fetchData: () => Promise<void>;
  fetchFocusedReport: () => Promise<void>;
  fetchStudentIntelligence: () => Promise<void>;
  buildSharedSearchParams: () => URLSearchParams;
  buildQuery: () => string;
  buildFocusedParams: () => URLSearchParams;
  debugDiagnostics: {
    mismatchKeys: string[];
    staleSources: string[];
    expectedCount: number;
    normalizedCount: number;
    filterKey: string;
  } | null;
};

const AnalyticsFilterContext = createContext<AnalyticsFilterContextValue | null>(null);

const buildExecBoot = () => {
  if (typeof window === "undefined") {
    return { snap: {} as Partial<ExecutiveUiSnapshot> };
  }
  const snap = readExecutiveSnapshot();
  hydrateLocalStoragePanelsFromSnapshot(snap);
  return { snap };
};

export const AnalyticsFilterProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const locale = getLocale();
  const isAr = locale === "ar";
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<AnalyticsTab>("general");
  const [data, setData] = useState<ParticipationAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataDegraded, setDataDegraded] = useState(false);
  const [page, setPage] = useState(1);
  const [focusedPage, setFocusedPage] = useState(1);
  const [execBoot] = useState(buildExecBoot);
  const [focusedOutcome, setFocusedOutcome] = useState(() => execBoot.snap.focusedOutcome ?? "all");
  const [focusedPick, setFocusedPick] = useState(() => execBoot.snap.focusedPick ?? "");
  const [focusedActivityOptions, setFocusedActivityOptions] = useState<
    AnalyticsFilterContextValue["focusedActivityOptions"]
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
    return "full";
  });
  const [f, setF] = useState<ExecutiveFilterSnapshot>(() => mergeExecutiveSnapshotIntoFilter(execBoot.snap));
  const fetchGenRef = useRef(0);

  const deferredF = useDeferredValue(f);

  const categoryOptions = useMemo(() => getReportCategoryOptions(isAr ? "ar" : "en"), [isAr]);
  const levelOptions = useMemo(() => getReportLevelOptions(isAr ? "ar" : "en"), [isAr]);
  const resultOptions = useMemo(() => getReportResultOptions(isAr ? "ar" : "en"), [isAr]);

  const buildSharedSearchParams = useCallback(() => {
    const sp = new URLSearchParams();
    sp.set("academicYear", deferredF.academicYear);
    sp.set("gender", deferredF.gender);
    sp.set("mawhiba", deferredF.mawhiba);
    sp.set("stage", deferredF.stage);
    sp.set("grade", deferredF.grade);
    sp.set("section", deferredF.section);
    if (deferredF.categories.length) sp.set("category", deferredF.categories.join(","));
    if (deferredF.levels.length) sp.set("level", deferredF.levels.join(","));
    if (deferredF.resultTokens.length) sp.set("result", deferredF.resultTokens.join(","));
    sp.set("status", deferredF.status);
    sp.set("certificateStatus", deferredF.certificateStatus);
    if (deferredF.fromDate) sp.set("fromDate", deferredF.fromDate);
    if (deferredF.toDate) sp.set("toDate", deferredF.toDate);
    if (deferredF.domain.trim()) sp.set("domain", deferredF.domain.trim());
    if (deferredF.classification.trim()) sp.set("classification", deferredF.classification.trim());
    if (deferredF.organization.trim()) sp.set("organization", deferredF.organization.trim());
    return sp;
  }, [deferredF]);

  const filterKey = useMemo(() => buildSharedSearchParams().toString(), [buildSharedSearchParams]);

  const buildQuery = useCallback(() => {
    const sp = buildSharedSearchParams();
    sp.set("page", String(page));
    sp.set("pageSize", "25");
    return sp.toString();
  }, [buildSharedSearchParams, page]);

  const buildFocusedParams = useCallback(() => {
    const sp = buildSharedSearchParams();
    if (deferredF.primaryType && deferredF.primaryType !== "all") {
      sp.set("primaryType", deferredF.primaryType);
    }
    return sp;
  }, [buildSharedSearchParams, deferredF.primaryType]);

  const fetchData = useCallback(async () => {
    const gen = ++fetchGenRef.current;
    setLoading(true);
    setError(null);
    setDataDegraded(false);
    const q = buildQuery();
    const result = await resilientFetchJson<
      ParticipationAnalyticsPayload & { degraded?: boolean; error?: string }
    >(`/api/admin/reports/achievement-participation?${q}`, { credentials: "include" }, {
      staleKey: `anjal-participation:${q}`,
      staleMaxAgeMs: 10 * 60_000,
      retries: 2,
    });
    if (gen !== fetchGenRef.current) return;
    if (!result.ok) {
      if (result.status === 401) {
        router.push("/login");
        return;
      }
      if (result.status === 403) {
        setAllowed(false);
        return;
      }
      setError(isAr ? "تعذر تحميل التقرير." : "Could not load the report.");
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
      if (j.activityOptions?.length) {
        setFocusedActivityOptions(j.activityOptions);
      }
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
      const j = (await res.json()) as FocusedActivityOptionsPayload & { error?: string };
      if (!res.ok || !j.ok) throw new Error("Request failed");
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
      const j = (await res.json()) as FocusedActivityReportPayload & { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) throw new Error(typeof j.error === "string" ? j.error : "Request failed");
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
    setCompareLoading(true);
    try {
      const sp = buildFocusedParams();
      sp.set("focusType", focusType);
      sp.set("focusRaw", focusRaw);
      sp.set("focusedOutcome", focusedOutcome);
      sp.set("page", "1");
      sp.set("pageSize", "25");
      const res = await fetch(`/api/admin/reports/achievement-participation/focused?${sp.toString()}`, {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Request failed");
      const j = (await res.json()) as FocusedActivityReportPayload;
      if (!j.ok) throw new Error("Request failed");
      setCompareData(j);
      setCompareError(null);
    } catch (e) {
      setCompareError(e instanceof Error ? e.message : "Error");
      setCompareData(null);
    } finally {
      setCompareLoading(false);
    }
  }, [buildFocusedParams, compareEnabled, comparePick, focusedOutcome]);

  const fetchStudentIntelligence = useCallback(async () => {
    setStudentIntelLoading(true);
    setStudentIntelError(null);
    try {
      const sp = buildFocusedParams();
      const res = await fetch(
        `/api/admin/reports/achievement-participation/student-intelligence?${sp.toString()}`,
        { cache: "no-store", credentials: "include" }
      );
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const j = (await res.json()) as StudentIntelligencePayload & { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) throw new Error("Request failed");
      setStudentIntelData(j);
    } catch (e) {
      setStudentIntelError(e instanceof Error ? e.message : "Error");
      setStudentIntelData(null);
    } finally {
      setStudentIntelLoading(false);
    }
  }, [buildFocusedParams, router]);

  const refreshAll = useCallback(() => {
    void fetchData();
    if (activeTab === "focused") {
      void fetchFocusedOptions();
      void fetchFocusedReport();
      if (compareEnabled && comparePick) void fetchCompareReport();
    }
    if (activeTab === "studentIntel") void fetchStudentIntelligence();
  }, [
    fetchData,
    fetchFocusedOptions,
    fetchFocusedReport,
    fetchCompareReport,
    fetchStudentIntelligence,
    activeTab,
    compareEnabled,
    comparePick,
  ]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      writeExecutiveSnapshot({
        focusedPick: focusedPick || undefined,
        comparePick: comparePick || undefined,
        compareEnabled,
        pdfPreset,
        focusedOutcome,
        filter: cloneExecutiveFilterSnapshot(f),
        ...captureExecutiveAuxLocalState(),
      });
    }, 400);
    return () => window.clearTimeout(t);
  }, [focusedPick, comparePick, compareEnabled, pdfPreset, focusedOutcome, f]);

  useEffect(() => {
    if (allowed !== true) return;
    const t = window.setTimeout(() => {
      void fetchData();
    }, 280);
    return () => window.clearTimeout(t);
  }, [allowed, filterKey, page, fetchData]);

  useEffect(() => {
    if (allowed !== true || activeTab !== "focused") return;
    const t = window.setTimeout(() => {
      void fetchFocusedOptions();
    }, 300);
    return () => window.clearTimeout(t);
  }, [allowed, activeTab, filterKey, fetchFocusedOptions]);

  useEffect(() => {
    if (allowed !== true || activeTab !== "focused") return;
    const t = window.setTimeout(() => {
      void fetchFocusedReport();
    }, 320);
    return () => window.clearTimeout(t);
  }, [allowed, activeTab, filterKey, focusedPick, focusedOutcome, focusedPage, fetchFocusedReport]);

  useEffect(() => {
    if (allowed !== true || activeTab !== "focused" || !compareEnabled || !comparePick) return;
    const t = window.setTimeout(() => {
      void fetchCompareReport();
    }, 350);
    return () => window.clearTimeout(t);
  }, [allowed, activeTab, filterKey, compareEnabled, comparePick, focusedOutcome, fetchCompareReport]);

  useEffect(() => {
    if (allowed !== true || activeTab !== "studentIntel") return;
    const t = window.setTimeout(() => {
      void fetchStudentIntelligence();
    }, 300);
    return () => window.clearTimeout(t);
  }, [allowed, activeTab, filterKey, fetchStudentIntelligence]);

  const canonicalSnapshot = useMemo(
    () =>
      buildAnalyticsCanonicalSnapshot({
        general: data,
        focused: focusedData,
        studentIntel: studentIntelData,
      }),
    [data, focusedData, studentIntelData]
  );

  const insights = useMemo(
    () =>
      buildAnalyticsInsights({
        snapshot: canonicalSnapshot,
        general: data,
        focused: focusedData,
      }),
    [canonicalSnapshot, data, focusedData]
  );

  const studentIntelGovernance = useMemo(() => {
    const age = studentIntelData?.ciObservability?.cacheAgeMs;
    return runStudentIntelGovernance(studentIntelData, age);
  }, [studentIntelData]);

  const analyticsTrustReport = useMemo(
    () =>
      runAnalyticsConsistencyEngine({
        general: data,
        focused: focusedData,
        compareA: compareEnabled && comparePick ? focusedData : null,
        compareB: compareEnabled && comparePick ? compareData : null,
        studentIntel: studentIntelData,
        governance: {
          level: studentIntelGovernance.level,
          issues: studentIntelGovernance.issues.map((i) => i.code),
        },
      }),
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

  const debugDiagnostics = useMemo(() => {
    if (!isCompetitionIntelDebugEnabled()) return null;
    return {
      mismatchKeys: analyticsTrustReport.issues,
      staleSources: [
        ...(data?.ciObservability?.cacheHit ? ["general"] : []),
        ...(focusedData?.ciObservability?.cacheHit ? ["focused"] : []),
      ],
      expectedCount: data?.kpis.totalParticipations ?? 0,
      normalizedCount: canonicalSnapshot.totalParticipations,
      filterKey,
    };
  }, [analyticsTrustReport.issues, data, focusedData, canonicalSnapshot.totalParticipations, filterKey]);

  const value: AnalyticsFilterContextValue = {
    isAr,
    allowed,
    setAllowed,
    activeTab,
    setActiveTab,
    f,
    setF,
    page,
    setPage,
    focusedPage,
    setFocusedPage,
    focusedOutcome,
    setFocusedOutcome,
    focusedPick,
    setFocusedPick,
    focusedActivityOptions,
    compareEnabled,
    setCompareEnabled,
    comparePick,
    setComparePick,
    pdfPreset,
    setPdfPreset,
    data,
    loading,
    error,
    dataDegraded,
    focusedData,
    focusedLoading,
    focusedError,
    focusedOptionsLoading,
    compareData,
    compareLoading,
    compareError,
    studentIntelData,
    studentIntelLoading,
    studentIntelError,
    categoryOptions,
    levelOptions,
    resultOptions,
    canonicalSnapshot,
    insights,
    analyticsTrustReport,
    cacheAgeLabel,
    filterKey,
    refreshAll,
    fetchData,
    fetchFocusedReport,
    fetchStudentIntelligence,
    buildSharedSearchParams,
    buildQuery,
    buildFocusedParams,
    debugDiagnostics,
  };

  return (
    <AnalyticsFilterContext.Provider value={value}>{children}</AnalyticsFilterContext.Provider>
  );
};

export const useAnalyticsFilters = (): AnalyticsFilterContextValue => {
  const ctx = useContext(AnalyticsFilterContext);
  if (!ctx) throw new Error("useAnalyticsFilters must be used within AnalyticsFilterProvider");
  return ctx;
};

export const useCanonicalAnalyticsDataset = () => {
  const { canonicalSnapshot } = useAnalyticsFilters();
  return canonicalSnapshot;
};

export const useAnalyticsDerivedState = () => {
  const { insights, analyticsTrustReport, cacheAgeLabel, debugDiagnostics, canonicalSnapshot } =
    useAnalyticsFilters();
  return { insights, analyticsTrustReport, cacheAgeLabel, debugDiagnostics, canonicalSnapshot };
};
