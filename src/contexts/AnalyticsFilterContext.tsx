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
} from "react";
import { useRouter } from "next/navigation";
import { defaultLocale, getLocale } from "@/lib/i18n";
import { useClientMounted } from "@/hooks/useClientMounted";
import { resilientFetchJson } from "@/lib/client/resilient-fetch";
import { useAnalyticsUrlSync } from "@/hooks/useAnalyticsUrlSync";
import type { AnalyticsUrlUiState } from "@/lib/analytics/report-filter-url-sync";
import { participationFilterFromExecutiveSnapshot } from "@/lib/analytics/report-filter-url-sync";
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
import { buildParticipationFilterSearchParams } from "@/lib/analytics/participation-filter-params";
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
import type { ExecutiveAnalyticsSnapshotPayload } from "@/lib/analytics/server/analytics-snapshot-schema";
import type { ExecutiveSnapshotResolveMeta } from "@/lib/analytics/server/analytics-snapshot-schema";
import type { AiDecisionEngineResult } from "@/lib/analytics/ai/ai-decision-schema";
import type { CiPdfExportPreset } from "@/lib/competition-intelligence-theme";
import { CI_PDF_PRESET_LABELS, CI_STORAGE_KEYS } from "@/lib/competition-intelligence-theme";
import {
  applyDrillDownToFilter,
  scrollAnalyticsTableIntoView,
  type AnalyticsDrillDownPatch,
} from "@/lib/analytics/analytics-drill-down";
import {
  applyDrillDownFromChart,
  type DrillChartPayload,
  type DrillChartSource,
  type DrillDownTrace,
} from "@/lib/analytics/analytics-drilldown-router";
import { buildAnalyticsTraceMeta, type AnalyticsTraceMeta } from "@/lib/analytics/analytics-traceability";
import {
  fetchWithAnalyticsSwr,
  buildAnalyticsCacheKey,
  invalidateAnalyticsCache,
} from "@/lib/analytics/analytics-client-cache";
import {
  abortInflightByPrefix,
  mergeAbortSignals,
} from "@/lib/analytics/runtime/analytics-inflight-registry";

export type AnalyticsTab = "general" | "focused" | "studentIntel" | "historical" | "decisions";

export type AnalyticsTableViewMode = "summary" | "activity" | "detailed" | "student";

export type ExplorationStep = {
  filter: ExecutiveFilterSnapshot;
  tableMode: AnalyticsTableViewMode;
  activeTab: AnalyticsTab;
  page: number;
  trace?: DrillDownTrace;
};

const EXPLORATION_HISTORY_MAX = 24;
const EXECUTIVE_MODE_KEY = "anjal-analytics-executive-mode";

export type AnalyticsTableSortKey =
  | "activity"
  | "participants"
  | "gold"
  | "silver"
  | "bronze"
  | "total"
  | "excellence";

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
  genderOptions: ReturnType<typeof getReportGenderOptions>;
  mawhibaOptions: ReturnType<typeof getReportMawhibaOptions>;
  stageOptions: ReturnType<typeof getReportStageOptions>;
  gradeOptions: ReturnType<typeof getReportGradeOptions>;
  statusOptions: ReturnType<typeof getReportStatusOptions>;
  certificateOptions: ReturnType<typeof getReportCertificateStatusOptions>;
  stdTestOptions: ReturnType<typeof getStandardizedTestTypeOptions>;
  sectionOptions: Array<{ value: string; label: string }>;
  canonicalSnapshot: AnalyticsCanonicalSnapshot;
  insights: AnalyticsInsightsBundle;
  analyticsTrustReport: CiConsistencyReport;
  cacheAgeLabel: string | null;
  filterKey: string;
  refreshAll: () => void;
  fetchData: () => Promise<void>;
  fetchFocusedReport: () => Promise<void>;
  /** Bumped on manual refresh — progressive panel refetches facets without scope=full. */
  focusedRefreshNonce: number;
  fetchStudentIntelligence: (opts?: { lite?: boolean; force?: boolean }) => Promise<void>;
  ensureStudentIntel: (opts?: { lite?: boolean; force?: boolean }) => void;
  buildSharedSearchParams: () => URLSearchParams;
  buildQuery: () => string;
  buildFocusedParams: () => URLSearchParams;
  copyShareUrl: () => string;
  traceMeta: AnalyticsTraceMeta;
  lastDrillTrace: DrillDownTrace | null;
  applyDrillDown: (patch: AnalyticsDrillDownPatch) => void;
  applyDrillFromChart: (source: DrillChartSource, payload: DrillChartPayload) => void;
  explorationHistory: ExplorationStep[];
  canDrillBack: boolean;
  drillBack: () => void;
  clearExplorationHistory: () => void;
  executiveMode: boolean;
  setExecutiveMode: (v: boolean) => void;
  executiveBundle: (Partial<ExecutiveAnalyticsSnapshotPayload> &
    Pick<
      ExecutiveAnalyticsSnapshotPayload,
      "version" | "aggregationVersion" | "computedAt" | "filterFingerprint" | "kpiStrip" | "trustIssues"
    >) | null;
  executiveBundleMeta: ExecutiveSnapshotResolveMeta | null;
  executiveBundleLoading: boolean;
  executiveAiDecisions: AiDecisionEngineResult | null;
  drillTransitioning: boolean;
  tableMode: AnalyticsTableViewMode;
  setTableMode: (m: AnalyticsTableViewMode) => void;
  tableSortKey: AnalyticsTableSortKey;
  setTableSortKey: (k: AnalyticsTableSortKey) => void;
  tableSortAsc: boolean;
  setTableSortAsc: (v: boolean) => void;
  debugDiagnostics: {
    mismatchKeys: string[];
    staleSources: string[];
    expectedCount: number;
    normalizedCount: number;
    filterKey: string;
  } | null;
};

const AnalyticsFilterContext = createContext<AnalyticsFilterContextValue | null>(null);

export const AnalyticsFilterProvider = ({
  children,
  enableUrlSync = true,
}: {
  children: ReactNode;
  enableUrlSync?: boolean;
}) => {
  const router = useRouter();
  const mounted = useClientMounted();
  const [isAr, setIsAr] = useState(defaultLocale === "ar");
  useEffect(() => {
    if (!mounted) return;
    setIsAr(getLocale() === "ar");
  }, [mounted]);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<AnalyticsTab>("general");
  const [data, setData] = useState<ParticipationAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataDegraded, setDataDegraded] = useState(false);
  const [page, setPage] = useState(1);
  const [focusedPage, setFocusedPage] = useState(1);
  const [prefsHydrated, setPrefsHydrated] = useState(false);
  const [focusedOutcome, setFocusedOutcome] = useState("all");
  const [focusedPick, setFocusedPick] = useState("");
  const [focusedActivityOptions, setFocusedActivityOptions] = useState<
    AnalyticsFilterContextValue["focusedActivityOptions"]
  >([]);
  const [focusedData, setFocusedData] = useState<FocusedActivityReportPayload | null>(null);
  const [focusedLoading, setFocusedLoading] = useState(false);
  const [focusedError, setFocusedError] = useState<string | null>(null);
  const [focusedOptionsLoading, setFocusedOptionsLoading] = useState(false);
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [comparePick, setComparePick] = useState("");
  const [compareData, setCompareData] = useState<FocusedActivityReportPayload | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [focusedRefreshNonce, setFocusedRefreshNonce] = useState(0);
  const [studentIntelData, setStudentIntelData] = useState<StudentIntelligencePayload | null>(null);
  const [studentIntelLoading, setStudentIntelLoading] = useState(false);
  const [studentIntelError, setStudentIntelError] = useState<string | null>(null);
  const [pdfPreset, setPdfPreset] = useState<CiPdfExportPreset>("full");
  const [f, setF] = useState<ExecutiveFilterSnapshot>(() => mergeExecutiveSnapshotIntoFilter({}));
  const [tableMode, setTableMode] = useState<AnalyticsTableViewMode>("summary");
  const [tableSortKey, setTableSortKey] = useState<AnalyticsTableSortKey>("total");
  const [tableSortAsc, setTableSortAsc] = useState(false);
  const [explorationHistory, setExplorationHistory] = useState<ExplorationStep[]>([]);
  const [lastDrillTrace, setLastDrillTrace] = useState<DrillDownTrace | null>(null);
  const [drillTransitioning, setDrillTransitioning] = useState(false);
  const [executiveMode, setExecutiveModeState] = useState(false);
  const [executiveBundle, setExecutiveBundle] = useState<
    (Partial<ExecutiveAnalyticsSnapshotPayload> &
      Pick<
        ExecutiveAnalyticsSnapshotPayload,
        "version" | "aggregationVersion" | "computedAt" | "filterFingerprint" | "kpiStrip" | "trustIssues"
      >) | null
  >(null);
  const [executiveBundleMeta, setExecutiveBundleMeta] = useState<ExecutiveSnapshotResolveMeta | null>(null);
  const [executiveBundleLoading, setExecutiveBundleLoading] = useState(false);
  const [executiveAiDecisions, setExecutiveAiDecisions] = useState<AiDecisionEngineResult | null>(null);
  const fetchGenRef = useRef(0);
  const executiveBundleGenRef = useRef(0);
  const bootAbortRef = useRef<AbortController | null>(null);
  const generalAbortRef = useRef<AbortController | null>(null);
  const executiveAbortRef = useRef<AbortController | null>(null);
  const focusedAbortRef = useRef<AbortController | null>(null);
  const compareAbortRef = useRef<AbortController | null>(null);
  const studentIntelAbortRef = useRef<AbortController | null>(null);
  const urlHydrationDoneRef = useRef(false);
  const studentIntelKeyRef = useRef<string | null>(null);
  const studentIntelDataRef = useRef<StudentIntelligencePayload | null>(null);
  const urlHadFiltersRef = useRef(false);
  studentIntelDataRef.current = studentIntelData;

  const intelDebug = useMemo(() => isCompetitionIntelDebugEnabled(), []);
  const logIntel = useCallback(
    (tag: string, payload: Record<string, unknown>) => {
      if (!intelDebug) return;
      // eslint-disable-next-line no-console
      console.info(tag, payload);
    },
    [intelDebug]
  );

  useEffect(() => {
    if (!mounted || prefsHydrated || !urlHydrationDoneRef.current) return;
    if (!urlHadFiltersRef.current) {
      const snap = readExecutiveSnapshot();
      hydrateLocalStoragePanelsFromSnapshot(snap);
      setF((prev) => mergeExecutiveSnapshotIntoFilter({ ...snap, filter: snap.filter ?? prev }));
      if (snap.focusedOutcome) setFocusedOutcome(snap.focusedOutcome);
      if (snap.focusedPick) setFocusedPick(snap.focusedPick);
      if (typeof snap.compareEnabled === "boolean") setCompareEnabled(snap.compareEnabled);
      if (snap.comparePick) setComparePick(snap.comparePick);
      if (snap.pdfPreset && (Object.keys(CI_PDF_PRESET_LABELS) as CiPdfExportPreset[]).includes(snap.pdfPreset)) {
        setPdfPreset(snap.pdfPreset);
      }
    }
    try {
      const em = localStorage.getItem(EXECUTIVE_MODE_KEY);
      if (em === "1") setExecutiveModeState(true);
    } catch {
      /* ignore */
    }
    setPrefsHydrated(true);
  }, [mounted, prefsHydrated]);

  const analyticsUi = useMemo<AnalyticsUrlUiState>(
    () => ({
      tab: activeTab,
      page,
      focusedPage,
      focusedOutcome,
      focusedPick: focusedPick || undefined,
      compareEnabled,
      comparePick: comparePick || undefined,
      pdfPreset,
      primaryType: f.primaryType,
      tableMode: tableMode !== "summary" ? tableMode : undefined,
      sortKey: tableSortAsc || tableSortKey !== "total" ? tableSortKey : undefined,
      sortAsc: tableSortAsc || undefined,
    }),
    [
      activeTab,
      page,
      focusedPage,
      focusedOutcome,
      focusedPick,
      compareEnabled,
      comparePick,
      pdfPreset,
      f.primaryType,
      tableMode,
      tableSortKey,
      tableSortAsc,
    ]
  );

  const handleHydrateFromUrl = useCallback(
    ({
      filters,
      ui,
      hasUrlFilters,
    }: {
      filters: ExecutiveFilterSnapshot;
      ui: AnalyticsUrlUiState;
      hasUrlFilters: boolean;
    }) => {
      urlHadFiltersRef.current = hasUrlFilters;
      if (hasUrlFilters) {
        setF(participationFilterFromExecutiveSnapshot(filters));
      }
      if (ui.tab) setActiveTab(ui.tab);
      if (ui.page && ui.page >= 1) setPage(ui.page);
      if (ui.focusedPage && ui.focusedPage >= 1) setFocusedPage(ui.focusedPage);
      if (ui.focusedOutcome) setFocusedOutcome(ui.focusedOutcome);
      if (ui.focusedPick !== undefined) setFocusedPick(ui.focusedPick);
      if (ui.compareEnabled !== undefined) setCompareEnabled(ui.compareEnabled);
      if (ui.comparePick !== undefined) setComparePick(ui.comparePick);
      if (ui.pdfPreset) setPdfPreset(ui.pdfPreset);
      if (ui.primaryType && ui.primaryType !== "all") {
        setF((p) => ({ ...p, primaryType: ui.primaryType! }));
      }
      const validModes: AnalyticsTableViewMode[] = ["summary", "activity", "detailed", "student"];
      if (ui.tableMode && validModes.includes(ui.tableMode as AnalyticsTableViewMode)) {
        setTableMode(ui.tableMode as AnalyticsTableViewMode);
      }
      const validSort: AnalyticsTableSortKey[] = [
        "activity",
        "participants",
        "gold",
        "silver",
        "bronze",
        "total",
        "excellence",
      ];
      if (ui.sortKey && validSort.includes(ui.sortKey as AnalyticsTableSortKey)) {
        setTableSortKey(ui.sortKey as AnalyticsTableSortKey);
      }
      if (ui.sortAsc !== undefined) setTableSortAsc(ui.sortAsc);
    },
    []
  );

  const { copyShareUrl } = useAnalyticsUrlSync({
    scope: "participation",
    enabled: enableUrlSync,
    filter: f,
    ui: analyticsUi,
    onHydrateFromUrl: handleHydrateFromUrl,
    hydrationDoneRef: urlHydrationDoneRef,
  });

  useEffect(() => {
    if (!enableUrlSync || typeof window === "undefined") return;
    const slug = new URLSearchParams(window.location.search).get("savedView")?.trim();
    if (!slug) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/admin/analytics/saved-views?scope=participation&slug=${encodeURIComponent(slug)}`,
          { credentials: "include" }
        );
        const j = (await res.json()) as {
          ok?: boolean;
          view?: {
            filterSnapshot: ExecutiveFilterSnapshot;
            uiSnapshot: Record<string, unknown>;
          };
        };
        if (cancelled || !res.ok || !j.ok || !j.view) return;
        setF(participationFilterFromExecutiveSnapshot(j.view.filterSnapshot));
        const ui = j.view.uiSnapshot;
        if (ui.tab === "general" || ui.tab === "focused" || ui.tab === "studentIntel") {
          setActiveTab(ui.tab);
        }
        if (typeof ui.page === "number") setPage(ui.page);
        if (typeof ui.focusedPage === "number") setFocusedPage(ui.focusedPage);
        if (typeof ui.focusedOutcome === "string") setFocusedOutcome(ui.focusedOutcome);
        if (typeof ui.focusedPick === "string") setFocusedPick(ui.focusedPick);
        if (typeof ui.compareEnabled === "boolean") setCompareEnabled(ui.compareEnabled);
        if (typeof ui.comparePick === "string") setComparePick(ui.comparePick);
        const modes: AnalyticsTableViewMode[] = ["summary", "activity", "detailed", "student"];
        if (modes.includes(ui.tableMode as AnalyticsTableViewMode)) {
          setTableMode(ui.tableMode as AnalyticsTableViewMode);
        }
      } catch {
        /* non-fatal */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enableUrlSync]);

  const deferredF = useDeferredValue(f);

  const categoryOptions = useMemo(() => getReportCategoryOptions(isAr ? "ar" : "en"), [isAr]);
  const levelOptions = useMemo(() => getReportLevelOptions(isAr ? "ar" : "en"), [isAr]);
  const resultOptions = useMemo(() => getReportResultOptions(isAr ? "ar" : "en"), [isAr]);
  const genderOptions = useMemo(() => getReportGenderOptions(isAr ? "ar" : "en"), [isAr]);
  const mawhibaOptions = useMemo(() => getReportMawhibaOptions(isAr ? "ar" : "en"), [isAr]);
  const stageOptions = useMemo(() => getReportStageOptions(isAr ? "ar" : "en"), [isAr]);
  const gradeOptions = useMemo(() => getReportGradeOptions(isAr ? "ar" : "en"), [isAr]);
  const statusOptions = useMemo(() => getReportStatusOptions(isAr ? "ar" : "en"), [isAr]);
  const certificateOptions = useMemo(() => getReportCertificateStatusOptions(isAr ? "ar" : "en"), [isAr]);
  const stdTestOptions = useMemo(() => getStandardizedTestTypeOptions(isAr ? "ar" : "en"), [isAr]);
  const sectionOptions = useMemo(
    () => [
      { value: "arabic", label: isAr ? "عربي" : "Arabic" },
      { value: "international", label: isAr ? "دولي" : "International" },
    ],
    [isAr]
  );

  const buildSharedSearchParams = useCallback(() => {
    return buildParticipationFilterSearchParams(deferredF);
  }, [deferredF]);

  const filterKey = useMemo(() => buildSharedSearchParams().toString(), [buildSharedSearchParams]);

  const traceMeta = useMemo(
    () =>
      buildAnalyticsTraceMeta({
        searchParams: buildSharedSearchParams(),
      }),
    [buildSharedSearchParams]
  );

  const setExecutiveMode = useCallback((v: boolean) => {
    setExecutiveModeState(v);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(EXECUTIVE_MODE_KEY, v ? "1" : "0");
      } catch {
        /* ignore */
      }
    }
  }, []);

  const applyDrillDown = useCallback((patch: AnalyticsDrillDownPatch) => {
    setF((prev) => applyDrillDownToFilter(prev, patch));
    if (patch.tableMode) setTableMode(patch.tableMode);
    setPage(1);
    if (patch.focusTable !== false) scrollAnalyticsTableIntoView();
  }, []);

  const applyDrillFromChart = useCallback(
    (source: DrillChartSource, payload: DrillChartPayload) => {
      setDrillTransitioning(true);
      setExplorationHistory((hist) => {
        const step: ExplorationStep = {
          filter: cloneExecutiveFilterSnapshot(f),
          tableMode,
          activeTab,
          page,
          trace: lastDrillTrace ?? undefined,
        };
        return [...hist.slice(-(EXPLORATION_HISTORY_MAX - 1)), step];
      });
      const result = applyDrillDownFromChart(source, payload, f);
      setF(result.mergedFilter);
      if (result.patch.tableMode) setTableMode(result.patch.tableMode);
      else if (result.target.tableMode) setTableMode(result.target.tableMode);
      setPage(1);
      setLastDrillTrace(result.trace);
      if (result.target.preferStudentTab) setActiveTab("studentIntel");
      if (result.target.scrollToTable) {
        requestAnimationFrame(() => scrollAnalyticsTableIntoView());
      }
      setDrillTransitioning(false);
    },
    [f, tableMode, activeTab, page, lastDrillTrace]
  );

  const drillBack = useCallback(() => {
    setExplorationHistory((hist) => {
      if (hist.length === 0) return hist;
      const prev = hist[hist.length - 1]!;
      setF(cloneExecutiveFilterSnapshot(prev.filter));
      setTableMode(prev.tableMode);
      setActiveTab(prev.activeTab);
      setPage(prev.page);
      setLastDrillTrace(prev.trace ?? null);
      return hist.slice(0, -1);
    });
  }, []);

  const clearExplorationHistory = useCallback(() => {
    setExplorationHistory([]);
    setLastDrillTrace(null);
  }, []);

  const canDrillBack = explorationHistory.length > 0;

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

  const fetchExecutiveBundle = useCallback(
    async (scope: "full" | "decisions" | "light" = "full") => {
    const gen = ++executiveBundleGenRef.current;
    if (executiveAbortRef.current) {
      logIntel("[EXEC_REPORT_ABORT]", { id: "executive-bundle", scope });
      executiveAbortRef.current.abort();
    }
    const localAc = new AbortController();
    executiveAbortRef.current = localAc;
    setExecutiveBundleLoading(true);
    try {
      const sp = buildSharedSearchParams();
      const params = Object.fromEntries(sp.entries());
      const cacheKey = buildAnalyticsCacheKey(`exec-bundle-${scope}`, params);
      const t0 = Date.now();
      logIntel("[EXEC_REPORT_FETCH]", { id: "executive-bundle", cacheKey, filterKey });
      const { data: result } = await fetchWithAnalyticsSwr(
        cacheKey,
        async (signal) => {
          return resilientFetchJson<{
            ok: boolean;
            bundle?: (Partial<ExecutiveAnalyticsSnapshotPayload> &
              Pick<
                ExecutiveAnalyticsSnapshotPayload,
                "version" | "aggregationVersion" | "computedAt" | "filterFingerprint" | "kpiStrip" | "trustIssues"
              >);
            aiDecisionBundle?: AiDecisionEngineResult | null;
            meta?: ExecutiveSnapshotResolveMeta;
          }>(
            `/api/admin/reports/achievement-participation/executive-bundle?${sp.toString()}&scope=${encodeURIComponent(
              scope
            )}`,
            { credentials: "include", signal: mergeAbortSignals(signal, localAc.signal) },
            { timeoutMs: 20_000, retries: 1 }
          );
        },
        { ttlMs: 60_000, staleMs: 20_000 }
      );
      logIntel("[EXEC_REPORT_FETCH]", {
        id: "executive-bundle:done",
        ms: Date.now() - t0,
        cacheKey,
        ok: result.ok,
        status: result.ok ? 200 : result.status,
      });
      if (localAc.signal.aborted) return;
      if (gen !== executiveBundleGenRef.current) return;
      if (result.ok && result.data.ok && result.data.bundle) {
        setExecutiveBundle(result.data.bundle);
        setExecutiveBundleMeta(result.data.meta ?? null);
        setExecutiveAiDecisions(
          result.data.aiDecisionBundle ?? result.data.bundle.aiDecisionBundle ?? null
        );
      } else {
        setExecutiveBundle(null);
        setExecutiveBundleMeta(null);
        setExecutiveAiDecisions(null);
      }
    } catch {
      if (localAc.signal.aborted) return;
      if (gen === executiveBundleGenRef.current) {
        setExecutiveBundle(null);
        setExecutiveBundleMeta(null);
        setExecutiveAiDecisions(null);
      }
    } finally {
      if (!localAc.signal.aborted && gen === executiveBundleGenRef.current) setExecutiveBundleLoading(false);
    }
  },
    [buildSharedSearchParams]
  );

  const fetchData = useCallback(async () => {
    const gen = ++fetchGenRef.current;
    if (generalAbortRef.current) {
      logIntel("[EXEC_REPORT_ABORT]", { id: "general" });
      generalAbortRef.current.abort();
    }
    const localAc = new AbortController();
    generalAbortRef.current = localAc;
    setLoading(true);
    setError(null);
    setDataDegraded(false);
    const q = buildQuery();
    const t0 = Date.now();
    logIntel("[EXEC_REPORT_FETCH]", { id: "general", q });
    const result = await resilientFetchJson<
      ParticipationAnalyticsPayload & { degraded?: boolean; error?: string }
    >(
      `/api/admin/reports/achievement-participation?${q}`,
      { credentials: "include", signal: localAc.signal },
      {
        staleKey: `anjal-participation:${q}`,
        staleMaxAgeMs: 10 * 60_000,
        retries: 1,
        timeoutMs: 18_000,
      }
    );
    logIntel("[EXEC_REPORT_FETCH]", {
      id: "general:done",
      ms: Date.now() - t0,
      ok: result.ok,
      status: result.ok ? 200 : result.status,
    });
    if (localAc.signal.aborted) return;
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
      const cacheKey = buildAnalyticsCacheKey("focused-options", Object.fromEntries(sp.entries()));
      const { data: j } = await fetchWithAnalyticsSwr(
        cacheKey,
        async (signal) => {
          const res = await fetch(
            `/api/admin/reports/achievement-participation/focused?${sp.toString()}`,
            { cache: "no-store", credentials: "include", signal }
          );
          if (res.status === 401) {
            router.push("/login");
            throw new Error("Unauthorized");
          }
          const body = (await res.json()) as FocusedActivityOptionsPayload & { error?: string };
          if (!res.ok || !body.ok) throw new Error("Request failed");
          return body;
        },
        { ttlMs: 5 * 60_000, staleMs: 45_000 }
      );
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
      if (focusedAbortRef.current) {
        logIntel("[FOCUSED_ABORT]", { facet: "focused-all" });
        focusedAbortRef.current.abort();
      }
      const localAc = new AbortController();
      focusedAbortRef.current = localAc;

      // Export / PDF paths only — UI uses progressive facets (scope ≠ full).
      const cacheKey = buildAnalyticsCacheKey("focused-report-full", Object.fromEntries(sp.entries()));
      const t0 = Date.now();
      logIntel("[FOCUSED_FULL_FETCH]", { cacheKey });
      const { data: j } = await fetchWithAnalyticsSwr(
        cacheKey,
        async (signal) => {
          const sp2 = new URLSearchParams(sp.toString());
          sp2.set("scope", "full");
          const res = await fetch(`/api/admin/reports/achievement-participation/focused?${sp2.toString()}`, {
            cache: "no-store",
            credentials: "include",
            signal: mergeAbortSignals(signal, localAc.signal),
          });
          if (res.status === 401) {
            router.push("/login");
            throw new Error("Unauthorized");
          }
          const body = (await res.json()) as FocusedActivityReportPayload & { ok?: boolean; error?: string };
          if (!res.ok || !body.ok) throw new Error(typeof body.error === "string" ? body.error : "Request failed");
          return body;
        },
        { ttlMs: 30_000, staleMs: 12_000 }
      );
      if (localAc.signal.aborted) return;
      setFocusedData(j);
      setFocusedError(null);
      logIntel("[FOCUSED_HYDRATION_COMPLETE]", {
        ms: Date.now() - t0,
        pick: focusedPick,
        outcome: focusedOutcome,
        rows: j.participants.length,
      });
    } catch (e) {
      if (focusedAbortRef.current?.signal.aborted) return;
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
      if (compareAbortRef.current) {
        logIntel("[EXEC_REPORT_ABORT]", { id: "focused-compare" });
        compareAbortRef.current.abort();
      }
      const localAc = new AbortController();
      compareAbortRef.current = localAc;
      const cacheKey = buildAnalyticsCacheKey("focused-compare", Object.fromEntries(sp.entries()));
      const { data: j } = await fetchWithAnalyticsSwr(
        cacheKey,
        async (signal) => {
          const spCompare = new URLSearchParams(sp.toString());
          spCompare.set("scope", "compare");
          const res = await fetch(`/api/admin/reports/achievement-participation/focused?${spCompare.toString()}`, {
            cache: "no-store",
            credentials: "include",
            signal: mergeAbortSignals(signal, localAc.signal),
          });
          if (!res.ok) throw new Error("Request failed");
          const body = (await res.json()) as FocusedActivityReportPayload;
          if (!body.ok) throw new Error("Request failed");
          return body;
        },
        { ttlMs: 30_000, staleMs: 12_000 }
      );
      if (localAc.signal.aborted) return;
      setCompareData(j);
      setCompareError(null);
    } catch (e) {
      if (compareAbortRef.current?.signal.aborted) return;
      setCompareError(e instanceof Error ? e.message : "Error");
      setCompareData(null);
    } finally {
      setCompareLoading(false);
    }
  }, [buildFocusedParams, compareEnabled, comparePick, focusedOutcome]);

  const fetchStudentIntelligence = useCallback(
    async (opts?: { lite?: boolean; force?: boolean }) => {
      const sp = buildFocusedParams();
      const useLite = opts?.lite ?? activeTab !== "studentIntel";
      if (useLite) sp.set("intelScope", "lite");
      const cacheKey = buildAnalyticsCacheKey("student-intelligence", Object.fromEntries(sp.entries()));
      if (!opts?.force && studentIntelKeyRef.current === cacheKey && studentIntelDataRef.current) {
        return;
      }
      studentIntelKeyRef.current = cacheKey;
      studentIntelAbortRef.current?.abort();
      const localAc = new AbortController();
      studentIntelAbortRef.current = localAc;
      setStudentIntelLoading(true);
      setStudentIntelError(null);
      try {
        const { data: j } = await fetchWithAnalyticsSwr(
          cacheKey,
          async (signal) => {
            const res = await fetch(
              `/api/admin/reports/achievement-participation/student-intelligence?${sp.toString()}`,
              {
                cache: "no-store",
                credentials: "include",
                signal: mergeAbortSignals(signal, localAc.signal),
              }
            );
            if (res.status === 401) {
              router.push("/login");
              throw new Error("Unauthorized");
            }
            const body = (await res.json()) as StudentIntelligencePayload & { ok?: boolean; error?: string };
            if (!res.ok || !body.ok) throw new Error("Request failed");
            return body;
          },
          { ttlMs: 5 * 60_000, staleMs: 90_000 }
        );
        if (localAc.signal.aborted) return;
        setStudentIntelData(j);
        setStudentIntelError(null);
      } catch (e) {
        if (localAc.signal.aborted) return;
        if (e instanceof Error && e.message === "Unauthorized") return;
        if (e instanceof DOMException && e.name === "AbortError") return;
        setStudentIntelError(e instanceof Error ? e.message : "Error");
        if (!studentIntelDataRef.current) setStudentIntelData(null);
        studentIntelKeyRef.current = null;
      } finally {
        if (!localAc.signal.aborted) setStudentIntelLoading(false);
      }
    },
    [buildFocusedParams, router, activeTab]
  );

  const ensureStudentIntel = useCallback(
    (opts?: { lite?: boolean; force?: boolean }) => {
      void fetchStudentIntelligence({ lite: opts?.lite ?? true, force: opts?.force });
    },
    [fetchStudentIntelligence]
  );

  const refreshAll = useCallback(async () => {
    await fetchData();
    await fetchExecutiveBundle();
    if (activeTab === "focused") {
      await fetchFocusedOptions();
      setFocusedRefreshNonce((n) => n + 1);
    } else if (activeTab === "studentIntel") {
      await fetchStudentIntelligence({ lite: false, force: true });
    }
  }, [fetchData, fetchExecutiveBundle, fetchFocusedOptions, fetchStudentIntelligence, activeTab]);

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
    invalidateAnalyticsCache("student-intelligence");
    abortInflightByPrefix("student-intelligence:");
    studentIntelKeyRef.current = null;
  }, [filterKey]);

  // General report: depends on filterKey + page only (NOT focused states)
  useEffect(() => {
    if (allowed !== true) return;
    const t = window.setTimeout(() => {
      void fetchData();
    }, 220);
    return () => window.clearTimeout(t);
  }, [allowed, filterKey, page, fetchData]);

  // Executive bundle is expensive: only load when needed (decisions tab or executive mode)
  useEffect(() => {
    if (allowed !== true) return;
    const needsExec = executiveMode || activeTab === "decisions";
    if (!needsExec) return;
    const scope = activeTab === "decisions" && !executiveMode ? "decisions" : "full";
    const t = window.setTimeout(() => {
      void fetchExecutiveBundle(scope);
    }, 260);
    return () => window.clearTimeout(t);
  }, [allowed, filterKey, executiveMode, activeTab, fetchExecutiveBundle]);

  useEffect(() => {
    const needsExec = executiveMode || activeTab === "decisions";
    if (needsExec) return;
    executiveAbortRef.current?.abort();
    setExecutiveBundle(null);
    setExecutiveBundleMeta(null);
    setExecutiveAiDecisions(null);
    setExecutiveBundleLoading(false);
  }, [executiveMode, activeTab]);

  // Focused options: only when focused tab is active (and filterKey changes)
  useEffect(() => {
    if (allowed !== true) return;
    if (activeTab !== "focused") return;
    const t = window.setTimeout(() => {
      void fetchFocusedOptions();
    }, 260);
    return () => window.clearTimeout(t);
  }, [allowed, activeTab, filterKey, fetchFocusedOptions]);

  // Focused + compare progressive hydration: FocusedExecutiveIntelligencePanel (facets), not scope=full here.

  // Student intel: only when tab active (avoid background rebuild storms)
  useEffect(() => {
    if (allowed !== true) return;
    if (activeTab !== "studentIntel") return;
    const t = window.setTimeout(() => {
      void fetchStudentIntelligence({ lite: false, force: false });
    }, 280);
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

  const insights = useMemo(() => {
    if (executiveBundle?.insights) return executiveBundle.insights;
    return buildAnalyticsInsights({
      snapshot: canonicalSnapshot,
      general: data,
      focused: focusedData,
    });
  }, [executiveBundle, canonicalSnapshot, data, focusedData]);

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
    genderOptions,
    mawhibaOptions,
    stageOptions,
    gradeOptions,
    statusOptions,
    certificateOptions,
    stdTestOptions,
    sectionOptions,
    canonicalSnapshot,
    insights,
    analyticsTrustReport,
    cacheAgeLabel,
    filterKey,
    refreshAll,
    fetchData,
    fetchFocusedReport,
    focusedRefreshNonce,
    fetchStudentIntelligence,
    ensureStudentIntel,
    buildSharedSearchParams,
    buildQuery,
    buildFocusedParams,
    copyShareUrl,
    traceMeta,
    lastDrillTrace,
    applyDrillDown,
    applyDrillFromChart,
    explorationHistory,
    canDrillBack,
    drillBack,
    clearExplorationHistory,
    executiveMode,
    setExecutiveMode,
    executiveBundle,
    executiveBundleMeta,
    executiveBundleLoading,
    executiveAiDecisions,
    drillTransitioning,
    tableMode,
    setTableMode,
    tableSortKey,
    setTableSortKey,
    tableSortAsc,
    setTableSortAsc,
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
