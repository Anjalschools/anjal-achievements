"use client";

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PageContainer from "@/components/layout/PageContainer";
import ExecutiveWorkspaceShell from "@/components/analytics/layouts/ExecutiveWorkspaceShell";
import ExecutivePageChrome from "@/components/analytics/layouts/ExecutivePageChrome";
import ExecutiveControlBar, {
  ExecutiveControlBarGroup,
} from "@/components/analytics/layouts/ExecutiveControlBar";
import ExecutiveWorkspaceEmptyState from "@/components/analytics/ExecutiveWorkspaceEmptyState";
import { FocusedExecutiveIntelligencePanel } from "@/components/admin/FocusedExecutiveIntelligencePanel";
import {
  exportFocusedCompetitionAnalyticsPdf,
  exportFocusedExecutiveReportPdf,
  exportFocusedParticipantSelectionPdf,
  exportLandscapeExecutivePdfView,
  exportRowsToExcelWorkbook,
  decisionRowsForExport,
  type ExecutivePdfMetadata,
} from "@/lib/report-export";
import { CompetitionExportOverlay } from "@/components/admin/CompetitionExportOverlay";
import {
  runCompetitionExecutiveExport,
  type CompetitionExportState,
  exportPhaseMessages,
} from "@/lib/competition-export-controller";
import {
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
  medalConversionRate,
  outcomeCount,
  topYearFromTrend,
} from "@/lib/analytics/participation-dashboard-derivations";
import { AnalyticsFilterProvider, useAnalyticsFilters, useAnalyticsDerivedState } from "@/contexts/AnalyticsFilterContext";
import {
  ciRedactLine,
  createCorrelationId,
  logEmptyDatasetIntel,
} from "@/lib/competition-intelligence-debug";
import {
  appendCiExportAudit,
  buildDiagnosticsSummary,
  readCiExportAudit,
} from "@/lib/competition-intelligence-export-audit";
import { CI_AGGREGATION_VERSION } from "@/lib/competition/analytics/aggregation-version";
import { getCompetitionIntelAccess } from "@/lib/competition-intelligence-permissions";
import type { StudentIntelligencePayload, StudentProfileInsightPayload } from "@/lib/student-intelligence-analytics";
import { CI_PDF_PRESET_LABELS, CI_STORAGE_KEYS, type CiPdfExportPreset } from "@/lib/competition-intelligence-theme";
import { Loader2, RefreshCw } from "lucide-react";
import type { ParticipationActivityRow } from "@/lib/achievement-participation-analytics";
import { FOCUSED_ACHIEVEMENT_OUTCOMES, type FocusedActivityReportPayload } from "@/types/focused-activity-report";
import { buildAnalyticsCacheKey, fetchWithAnalyticsSwr } from "@/lib/analytics/analytics-client-cache";
import { mergeAbortSignals } from "@/lib/analytics/runtime/analytics-inflight-registry";
import {
  logFocusedClientTelemetry,
  sanitizeFocusedClientError,
} from "@/lib/analytics/focused-client-telemetry";
import {
  initExecAnalyticsRuntimeDevExpose,
  recordExecExportRuntimeEnd,
  recordExecExportRuntimeStart,
  recordExecFacetEnd,
  recordExecFacetStart,
  recordExecInflightEnd,
  recordExecInflightStart,
  recordExecRequestAborted,
  sampleExecClientMemory,
} from "@/lib/analytics/runtime/runtime-health-registry";
import {
  endExecExportRuntime,
  startExecExportRuntime,
} from "@/lib/analytics/runtime/exec-export-runtime";
import { ExecutiveRuntimeRecoveryBoundary } from "@/components/analytics/runtime/ExecutiveRuntimeRecoveryBoundary";
import { ExecutiveRuntimeDebugOverlay } from "@/components/analytics/runtime/ExecutiveRuntimeDebugOverlay";

import ResponsiveAnalyticsFilters from "@/components/analytics/ResponsiveAnalyticsFilters";
import AnalyticsSavedViewsPanel from "@/components/analytics/AnalyticsSavedViewsPanel";
import ParticipationIntelligenceDashboard from "@/components/analytics/ParticipationIntelligenceDashboard";
import HistoricalTablesWorkspace from "@/components/analytics/HistoricalTablesWorkspace";
import AnalyticsPerspectiveBridge from "@/components/analytics/AnalyticsPerspectiveBridge";
import GlobalPerspectiveToolbar from "@/components/analytics/GlobalPerspectiveToolbar";
import { StudentExcellenceWorkspace } from "@/components/analytics/StudentExcellenceWorkspace";
import StudentIntelligenceBoundary from "@/components/analytics/runtime/StudentIntelligenceBoundary";
import LazyStudentIntelligenceTrigger from "@/components/analytics/runtime/LazyStudentIntelligenceTrigger";
import { ExecutiveDecisionWorkspace } from "@/components/analytics/ExecutiveDecisionWorkspace";
import { CompetitionDecisionWorkspace } from "@/components/admin/CompetitionDecisionWorkspace";
import { useAnalyticsPerspective } from "@/lib/analytics/analytics-perspective-context";
import { clearParticipationFilters } from "@/components/analytics/AnalyticsFilterBreadcrumb";
import {
  pageTitle,
  pageSubtitle,
  formatAvgParticipationsPerStudentLine,
  t,
} from "@/lib/analytics/analytics-semantics";

const AdminParticipationAnalyticsPageContent = () => {
  const router = useRouter();
  const { exportTitleSuffix } = useAnalyticsPerspective();
  const {
    isAr,
    allowed,
    setAllowed,
    activeTab,
    setActiveTab,
    data,
    loading,
    error,
    dataDegraded,
    page,
    setPage,
    focusedPage,
    setFocusedPage,
    focusedOutcome,
    setFocusedOutcome,
    focusedPick,
    setFocusedPick,
    focusedActivityOptions,
    focusedData,
    focusedLoading,
    focusedError,
    focusedOptionsLoading,
    compareEnabled,
    setCompareEnabled,
    comparePick,
    setComparePick,
    compareData,
    compareLoading,
    compareError,
    studentIntelData,
    studentIntelLoading,
    studentIntelError,
    pdfPreset,
    setPdfPreset,
    f,
    setF,
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
    insights,
    analyticsTrustReport,
    cacheAgeLabel,
    debugDiagnostics,
    buildFocusedParams,
    fetchData,
    copyShareUrl,
    traceMeta,
    executiveMode,
    setExecutiveMode,
    executiveBundle,
    executiveBundleMeta,
    executiveAiDecisions,
    filterKey,
    refreshAll,
    fetchFocusedReport,
    focusedRefreshNonce,
    fetchStudentIntelligence,
  } = useAnalyticsFilters();
  const { canonicalSnapshot } = useAnalyticsDerivedState();

  const [studentProfilePid, setStudentProfilePid] = useState<string | null>(null);
  const [studentProfileReloadKey, setStudentProfileReloadKey] = useState(0);
  const [studentProfileData, setStudentProfileData] = useState<StudentProfileInsightPayload | null>(null);
  const [studentProfileLoading, setStudentProfileLoading] = useState(false);
  const [studentProfileError, setStudentProfileError] = useState<string | null>(null);

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
  const [focusedDecisionReport, setFocusedDecisionReport] = useState<FocusedActivityReportPayload | null>(null);

  const handleFocusedDecisionReady = useCallback((report: FocusedActivityReportPayload | null) => {
    setFocusedDecisionReport(report);
  }, []);

  const intelAccess = useMemo(() => getCompetitionIntelAccess(viewerRole || undefined), [viewerRole]);
  const [focusedRuntimeRecoveryKey, setFocusedRuntimeRecoveryKey] = useState(0);

  useEffect(() => {
    initExecAnalyticsRuntimeDevExpose();
  }, []);

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
    if (activeTab !== "studentIntel") {
      setStudentProfilePid(null);
      setStudentProfileData(null);
      setStudentProfileError(null);
    }
  }, [activeTab]);

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

  const title = pageTitle(isAr ? "ar" : "en");

  const headers = useMemo(
    () =>
      isAr
        ? [
            "اسم النشاط",
            "النوع الرئيسي",
            "التصنيف الفرعي",
            "المستوى",
            "النتيجة",
            "الطلاب المشاركون",
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
            t("export.totalParticipations", "ar"),
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
            t("export.totalParticipations", "en"),
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
            "الطلاب المشاركون": r.distinctParticipants,
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
            [t("export.totalParticipations", "ar")]: r.totalParticipations,
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
            [t("export.totalParticipations", "en")]: r.totalParticipations,
          };
      return base as unknown as Record<string, string | number>;
    });
  }, [data, isAr]);

  const kpi = data?.kpis;

  const summaryLines = useMemo(() => {
    if (!kpi || !data) return [];
    const silver = outcomeCount(data, "silver");
    const bronze = outcomeCount(data, "bronze");
    const conversion = medalConversionRate(data);
    const peakYear = topYearFromTrend(data);
    const avgLine = formatAvgParticipationsPerStudentLine(
      kpi.totalParticipations,
      kpi.distinctStudents,
      isAr ? "ar" : "en"
    );
    const lines = isAr
      ? [
          `إجمالي المشاركات: ${kpi.totalParticipations}`,
          `الطلاب المشاركون: ${kpi.distinctStudents}`,
          `متوسط المشاركات لكل طالب: ${avgLine}`,
          `ذهبية: ${kpi.goldMedalCount} · فضية: ${silver} · برونزية: ${bronze}`,
          `معدل تحويل الميداليات: ${conversion}%`,
          `أعلى نشاط: ${kpi.topProgramLabelAr}`,
          `أعلى قسم: ${kpi.topSectionLabelAr}`,
          peakYear ? `أعلى سنة: ${peakYear.year} (${peakYear.rows} سجل)` : null,
          `إنجازات دولية: ${kpi.internationalAchievementPct}%`,
          `مراكز أولى: ${kpi.firstPlaceCount} · ترشيحات: ${kpi.nominationCount}`,
        ]
      : [
          `Total participations: ${kpi.totalParticipations}`,
          `Participating students: ${kpi.distinctStudents}`,
          `Average participations per student: ${avgLine}`,
          `Gold: ${kpi.goldMedalCount} · Silver: ${silver} · Bronze: ${bronze}`,
          `Medal conversion rate: ${conversion}%`,
          `Top activity: ${kpi.topProgramLabelEn}`,
          `Top section: ${kpi.topSectionLabelEn}`,
          peakYear ? `Peak year: ${peakYear.year} (${peakYear.rows} records)` : null,
          `International achievements: ${kpi.internationalAchievementPct}%`,
          `First places: ${kpi.firstPlaceCount} · Nominations: ${kpi.nominationCount}`,
        ];
    return lines.filter((x): x is string => Boolean(x));
  }, [kpi, data, isAr]);

  const reportTitle = `${title} — ${exportTitleSuffix}`;

  const handleExcel = () => {
    const decisionExport =
      executiveAiDecisions?.bundle.hasData ?
        decisionRowsForExport(executiveAiDecisions, isAr)
      : null;
    const decisionSummary =
      decisionExport ?
        [
          {
            metric: isAr ? "قرار تنفيذي" : "Executive decision",
            value: isAr ? executiveAiDecisions!.boardSummary.headlineAr : executiveAiDecisions!.boardSummary.headlineEn,
          },
          ...decisionExport.rows.map((r, i) => ({
            metric: `${isAr ? "قرار" : "Decision"} ${i + 1}`,
            value: String(r[decisionExport.headers[0]!] ?? ""),
          })),
        ]
      : [];
    void exportRowsToExcelWorkbook(tableRows, headers, reportTitle, "participation-analytics", {
      rtlSheet: isAr,
      trace: {
        generatedAt: traceMeta.generatedAt,
        analyticsBuildId: traceMeta.analyticsBuildId,
        datasetVersion: traceMeta.datasetVersion,
        filterHash: traceMeta.canonicalFilterHash,
      },
      summaryRows: [
        ...summaryLines.map((line, i) => ({
          metric: `line_${i + 1}`,
          value: line,
        })),
        ...decisionSummary,
      ],
    });
  };

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
    if (executiveAiDecisions?.bundle.hasData) {
      const { headers: dHeaders, rows: dRows } = decisionRowsForExport(executiveAiDecisions, isAr);
      blocks += `<div style="margin-bottom:14px;font-size:11px"><strong>${esc(isAr ? "قرارات تنفيذية (ذكاء القرار)" : "AI executive decisions")}</strong>`;
      blocks += `<p style="margin:6px 0">${esc(isAr ? executiveAiDecisions.boardSummary.headlineAr : executiveAiDecisions.boardSummary.headlineEn)}</p>`;
      blocks += `<table style="width:100%;border-collapse:collapse"><tr>${dHeaders.map((h) => `<th style="border:1px solid #cbd5e1;padding:4px">${esc(h)}</th>`).join("")}</tr>`;
      for (const row of dRows.slice(0, 12)) {
        blocks += `<tr>${dHeaders.map((h) => `<td style="border:1px solid #cbd5e1;padding:4px">${esc(String(row[h] ?? ""))}</td>`).join("")}</tr>`;
      }
      blocks += `</table></div>`;
    }
    void exportLandscapeExecutivePdfView(summaryLines, tableRows, headers, reportTitle, "/report-header.png", {
      blocksHtml: blocks || undefined,
    });
  };


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
    if (!focusedData?.participants?.length) return [];
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
    refreshAll();
  }, [refreshAll]);

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

  const fetchFocusedFacet = useCallback(
    async (input: {
      scope: "summary" | "participants" | "charts" | "trends" | "insights" | "compare";
      pick: string;
      outcome: string;
      page?: number;
      pageSize?: number;
      signal?: AbortSignal;
    }) => {
      const sep = input.pick.indexOf("\u001f");
      const focusType = sep === -1 ? input.pick : input.pick.slice(0, sep);
      const focusRaw = sep === -1 ? "" : input.pick.slice(sep + 1);
      const sp = buildFocusedParams();
      sp.set("focusType", focusType);
      sp.set("focusRaw", focusRaw);
      sp.set("focusedOutcome", input.outcome);
      sp.set("scope", input.scope);
      sp.set("page", String(input.page ?? focusedPage));
      sp.set("pageSize", String(input.pageSize ?? 25));
      const cacheKey = buildAnalyticsCacheKey("focused-facet", Object.fromEntries(sp.entries()));
      const correlationId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `fc-${Date.now()}`;

      logFocusedClientTelemetry("[FOCUSED_FETCH_START]", { scope: input.scope, correlationId, cacheKey });
      recordExecInflightStart(cacheKey, input.scope);
      recordExecFacetStart(input.scope, cacheKey, correlationId);

      try {
        const { data: body, fromCache } = await fetchWithAnalyticsSwr(
          cacheKey,
          async (swrSignal) => {
            const signal = mergeAbortSignals(swrSignal, input.signal);
            const res = await fetch(`/api/admin/reports/achievement-participation/focused?${sp.toString()}`, {
              cache: "no-store",
              credentials: "include",
              signal,
              headers: { "X-Correlation-Id": correlationId },
            });
            const parsed = (await res.json()) as Record<string, unknown> & {
              ok?: boolean;
              error?: string;
              correlationId?: string;
              userMessage?: string;
            };
            if (!res.ok || !parsed.ok) {
              const raw =
                typeof parsed.userMessage === "string"
                  ? parsed.userMessage
                  : typeof parsed.error === "string"
                    ? parsed.error
                    : "Facet request failed";
              throw new Error(sanitizeFocusedClientError(raw));
            }
            return parsed;
          },
          { ttlMs: 28_000, staleMs: 10_000 }
        );

        logFocusedClientTelemetry(
          fromCache ? "[FOCUSED_FETCH_DEDUPED]" : "[FOCUSED_FETCH_SUCCESS]",
          { scope: input.scope, correlationId, cacheKey, fromCache }
        );
        recordExecFacetEnd(input.scope, cacheKey);
        return body;
      } catch (e) {
        if (input.signal?.aborted) {
          logFocusedClientTelemetry("[FOCUSED_FETCH_ABORT]", { scope: input.scope, correlationId });
          recordExecRequestAborted(cacheKey, input.scope);
        }
        throw e;
      } finally {
        recordExecInflightEnd(cacheKey);
        sampleExecClientMemory();
      }
    },
    [buildFocusedParams, focusedPage]
  );

  /** Export-only full payload — does not hydrate React `focusedData` (UI stays progressive). */
  const ensureFullFocusedPayload = useCallback(async (): Promise<FocusedActivityReportPayload | null> => {
    if (focusedData?.decisionPlatform && focusedData?.executive && focusedData?.charts) {
      return focusedData;
    }
    if (!focusedPick) return null;
    const sep = focusedPick.indexOf("\u001f");
    const focusType = sep === -1 ? focusedPick : focusedPick.slice(0, sep);
    const focusRaw = sep === -1 ? "" : focusedPick.slice(sep + 1);
    const correlationId = createCorrelationId();
    const exportHandle = startExecExportRuntime(correlationId);
    recordExecExportRuntimeStart();
    const t0 = Date.now();
    try {
      const sp = buildFocusedParams();
      sp.set("focusType", focusType);
      sp.set("focusRaw", focusRaw);
      sp.set("focusedOutcome", focusedOutcome);
      sp.set("scope", "full");
      sp.set("page", String(focusedPage));
      sp.set("pageSize", "25");
      const res = await fetch(`/api/admin/reports/achievement-participation/focused?${sp.toString()}`, {
        cache: "no-store",
        credentials: "include",
        headers: { "X-Correlation-Id": correlationId },
      });
      const body = (await res.json()) as FocusedActivityReportPayload & { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) throw new Error(typeof body.error === "string" ? body.error : "Export payload failed");
      endExecExportRuntime(exportHandle, { ok: true });
      recordExecExportRuntimeEnd(Date.now() - t0);
      return body;
    } catch (e) {
      endExecExportRuntime(exportHandle, { ok: false });
      recordExecExportRuntimeEnd(Date.now() - t0);
      throw e;
    }
  }, [buildFocusedParams, focusedPick, focusedOutcome, focusedPage, focusedData]);

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
    const exportReport = await ensureFullFocusedPayload();
    const reportForExport = exportReport ?? focusedData;
    if (!reportForExport) return;
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
      generatedAtIso: traceMeta.generatedAt,
      generatedBy: userExportLabel || undefined,
      filtersSummary: ciBuildFiltersSummary(f, isAr),
      activityFocus: isAr ? focusedData.activityLabelAr : focusedData.activityLabelEn,
      reportPreset: isAr ? CI_PDF_PRESET_LABELS[pdfPreset].ar : CI_PDF_PRESET_LABELS[pdfPreset].en,
      confidentiality: isAr ? "داخلي — للاستخدام المؤسسي" : "Internal — institutional use",
      correlationId,
      aggregationVersion: CI_AGGREGATION_VERSION,
      trustStatus: analyticsTrustReport.level,
      analyticsBuildId: traceMeta.analyticsBuildId,
      datasetVersion: traceMeta.datasetVersion,
      filterHash: traceMeta.canonicalFilterHash,
      canonicalFilterHash: traceMeta.canonicalFilterHash,
      queryHash: traceMeta.queryHash,
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

        const dp = reportForExport.decisionPlatform;
        if (dp) {
          if (!reportForExport.executive?.kpiCards?.length) return;
          if (!reportForExport.charts?.resultBars?.length) return;
          await exportFocusedExecutiveReportPdf(
            {
              isAr,
              docTitle: isAr ? "تقرير تنفيذي — منصة الذكاء" : "Executive intelligence report",
              activityTitle: isAr ? reportForExport.activityLabelAr : reportForExport.activityLabelEn,
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
              kpis: (reportForExport.executive?.kpiCards ?? []).map((c) => ({
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
                resultBars: (reportForExport.charts?.resultBars ?? []).map((b) => ({
                  label: isAr ? b.labelAr : b.labelEn,
                  count: b.count,
                })),
                genderSlices: (reportForExport.charts?.genderPie ?? []).map((s) => ({
                  label: isAr ? s.nameAr : s.nameEn,
                  value: s.value,
                })),
                sectionSlices: (reportForExport.charts?.sectionPie ?? []).map((s) => ({
                  label: isAr ? s.nameAr : s.nameEn,
                  value: s.value,
                })),
                mawhibaSlices: (reportForExport.charts?.mawhibaPie ?? []).map((s) => ({
                  label: isAr ? s.nameAr : s.nameEn,
                  value: s.value,
                })),
                yearTrend: (reportForExport.charts?.yearTrend ?? []).map((y) => ({
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
              { label: isAr ? "إجمالي السجلات" : "Total records", value: String(focusedData.kpis?.totalRecords ?? 0) },
              { label: isAr ? "الطلاب المشاركون" : "Participating students", value: String(focusedData.kpis?.distinctStudents ?? 0) },
              { label: isAr ? "معتمد" : "Approved", value: String(focusedData.kpis?.approvedRecords ?? 0) },
              { label: isAr ? "نسبة التميز %" : "Excellence %", value: `${focusedData.kpis?.excellenceRatePct ?? 0}%` },
            ],
            charts: {
              resultBars: (focusedData.charts?.resultBars ?? []).map((b) => ({
                label: isAr ? b.labelAr : b.labelEn,
                count: b.count,
              })),
              genderSlices: (focusedData.charts?.genderPie ?? []).map((s) => ({
                label: isAr ? s.nameAr : s.nameEn,
                value: s.value,
              })),
              sectionSlices: (focusedData.charts?.sectionPie ?? []).map((s) => ({
                label: isAr ? s.nameAr : s.nameEn,
                value: s.value,
              })),
              mawhibaSlices: (focusedData.charts?.mawhibaPie ?? []).map((s) => ({
                label: isAr ? s.nameAr : s.nameEn,
                value: s.value,
              })),
              yearTrend: focusedData.charts?.yearTrend ?? [],
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
    ? Math.max(1, Math.ceil((focusedData.totalParticipants ?? 0) / (focusedData.pageSize ?? 25)))
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

  const exportControls = (
    <ExecutiveControlBar isAr={isAr}>
      <ExecutiveControlBarGroup isAr={isAr} label={isAr ? "البيانات" : "Data"}>
        <button
          type="button"
          onClick={() => {
            if (activeTab === "general") void fetchData();
            else if (activeTab === "focused") handleFocusedRefresh();
            else refreshAll();
          }}
          disabled={
            activeTab === "general"
              ? loading
              : activeTab === "focused"
                ? focusedLoading || focusedOptionsLoading
                : studentIntelLoading
          }
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-text shadow-sm hover:bg-gray-50 disabled:opacity-50"
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
      </ExecutiveControlBarGroup>
      <ExecutiveControlBarGroup isAr={isAr} label={isAr ? "تصدير" : "Export"}>
        {activeTab === "focused" ? (
          <>
            <label className="flex flex-col gap-0.5 text-[10px] font-semibold text-slate-700">
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
                className="min-w-[9rem] rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-900"
                aria-label={isAr ? "قالب التصدير التنفيذي" : "Executive export preset"}
              >
                {(Object.keys(CI_PDF_PRESET_LABELS) as CiPdfExportPreset[]).map((k) => (
                  <option key={k} value={k}>
                    {isAr ? CI_PDF_PRESET_LABELS[k].ar : CI_PDF_PRESET_LABELS[k].en}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-0.5 text-[10px] font-semibold text-slate-700">
              <span>{isAr ? "عرض محفوظ" : "Saved view"}</span>
              <select
                defaultValue=""
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) return;
                  handleApplySavedExecutiveView(v);
                  e.currentTarget.value = "";
                }}
                className="min-w-[8rem] rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-900"
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
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-text shadow-sm hover:bg-gray-50 disabled:opacity-40"
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
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-text shadow-sm hover:bg-gray-50 disabled:opacity-40"
        >
          Excel
        </button>
        <button
          type="button"
          onClick={() => {
            const url = copyShareUrl();
            if (!url) return;
            void navigator.clipboard?.writeText(url);
          }}
          className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-900 shadow-sm hover:bg-indigo-100"
          title={isAr ? "نسخ رابط التقرير مع الفلاتر الحالية" : "Copy report link with current filters"}
        >
          {isAr ? "نسخ الرابط" : "Copy link"}
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-text shadow-sm hover:bg-gray-50"
        >
          {isAr ? "طباعة" : "Print"}
        </button>
      </ExecutiveControlBarGroup>
    </ExecutiveControlBar>
  );

  return (
    <PageContainer className="max-w-[1440px]">
      <ExecutiveWorkspaceShell isAr={isAr}>
        <ExecutivePageChrome
          title={title}
          subtitle={pageSubtitle(isAr ? "ar" : "en")}
          isAr={isAr}
          controlBar={exportControls}
        />
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
        {allowed === true && analyticsTrustReport.level !== "synced" ? (
          <div
            className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-sm print:hidden"
            role="status"
            aria-label={isAr ? "حالة ثقة التحليلات" : "Analytics trust status"}
          >
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                analyticsTrustReport.level === "partial" ? "bg-amber-400" : "bg-red-600"
              }`}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black text-slate-900">
                {isAr ? "ثقة التحليلات" : "Analytics trust"}
              </p>
              <p className="text-[11px] leading-snug text-slate-600">
                {analyticsTrustReport.level === "partial" ?
                  isAr ?
                    "بعض المقارنات تقريبية أو بحاجة لمراجعة الفلاتر."
                  : "Some comparisons are approximate — review filters if unsure."
                : isAr ?
                  "تم رصد اختلاف — راجع وحدة البيانات أو أعد التحميل."
                : "Mismatch detected — refresh or review underlying data."}
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

        {debugDiagnostics ? (
          <section
            className="mb-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 font-mono text-[10px] text-slate-600 print:hidden"
            dir="ltr"
          >
            <p className="font-bold text-slate-800">CI debug</p>
            <p>filterKey={debugDiagnostics.filterKey.slice(0, 120)}…</p>
            <p>expected={debugDiagnostics.expectedCount} normalized={debugDiagnostics.normalizedCount}</p>
            <p>stale={debugDiagnostics.staleSources.join(",") || "—"}</p>
            <p>mismatch={debugDiagnostics.mismatchKeys.join(" · ") || "—"}</p>
            <p>sources={canonicalSnapshot.sourceKeys.join(",")}</p>
          </section>
        ) : null}

        <div className="mb-4 flex flex-wrap gap-3 text-sm print:hidden">
          <Link href="/admin/achievements/reports" className="font-semibold text-primary hover:underline">
            {isAr ? "← تقارير الإنجازات التفصيلية" : "← Detailed achievement reports"}
          </Link>
          <Link href="/admin/analytics" className="font-semibold text-primary hover:underline">
            {isAr ? "الإحصاءات المتقدمة" : "Advanced analytics"}
          </Link>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
          <button
            type="button"
            onClick={() => setExecutiveMode(!executiveMode)}
            className={`rounded-xl border px-4 py-2 text-sm font-bold transition ${
              executiveMode
                ? "border-indigo-300 bg-indigo-600 text-white"
                : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
            }`}
            aria-pressed={executiveMode}
          >
            {isAr ? (executiveMode ? "وضع القيادة: مفعّل" : "وضع القيادة") : executiveMode ? "Executive mode: on" : "Executive mode"}
          </button>
        </div>

        <div
          className="mb-4 flex flex-nowrap gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50/80 p-2 pb-3 print:hidden sm:flex-wrap"
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
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "decisions"}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
              activeTab === "decisions"
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-indigo-200"
                : "text-slate-600 hover:bg-white/70"
            }`}
            onClick={() => setActiveTab("decisions")}
          >
            {isAr ? "قرارات تنفيذية" : "Executive decisions"}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "historical"}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
              activeTab === "historical"
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-violet-200"
                : "text-slate-600 hover:bg-white/70"
            }`}
            onClick={() => {
              setActiveTab("historical");
            }}
          >
            {t("historical.tab", isAr ? "ar" : "en")}
          </button>
        </div>

        <ResponsiveAnalyticsFilters
          isAr={isAr}
          f={f}
          setF={setF}
          onPageReset={() => setPage(1)}
          categoryOptions={categoryOptions}
          levelOptions={levelOptions}
          resultOptions={resultOptions}
          genderOptions={genderOptions}
          mawhibaOptions={mawhibaOptions}
          stageOptions={stageOptions}
          gradeOptions={gradeOptions}
          statusOptions={statusOptions}
          certificateOptions={certificateOptions}
          stdTestOptions={stdTestOptions}
          sectionOptions={sectionOptions}
          subtitle={
            activeTab === "general"
              ? isAr
                ? "نطاق عام لجميع الأنشطة ضمن الفلاتر. للتقرير التفصيلي لمسابقة واحدة استخدم تبويب قرار المسابقات."
                : "Broad analytics for all activities under the filters. Use the competition decision tab for a single activity drill-down."
              : activeTab === "focused"
                ? isAr
                  ? "اضبط الفلاتر أدناه، ثم استخدم لوحة الذكاء لاختيار النشاط والمقارنة والتصدير التنفيذي."
                  : "Set filters below, then use the intelligence panel for activity selection, comparison, and executive export."
                : activeTab === "historical"
                  ? isAr
                    ? "اختر السنوات والنشاط لبناء جداول مقارنة احترافية متعددة الأبعاد."
                    : "Select years and activities to build professional multi-dimensional comparison tables."
                  : isAr
                    ? "نفس فلاتر النطاق العام لعرض أكثر الطلاب تميزًا حسب المشاركة، الميداليات، معدل النجاح، وتنوع الأنشطة."
                    : "Same global filters to rank students by participation, medals, success rate, and activity diversity."
          }
        />

        <AnalyticsSavedViewsPanel isAr={isAr} />

        {activeTab === "general" && allowed === true ? (
          <div className="mb-4">
            <GlobalPerspectiveToolbar />
          </div>
        ) : null}

        {activeTab === "historical" && allowed === true ? (
          <div className="mb-4">
            <GlobalPerspectiveToolbar />
          </div>
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

        {activeTab === "studentIntel" && allowed === true ? (
          <section className="mb-6 space-y-6 print:hidden" dir={isAr ? "rtl" : "ltr"}>
            <LazyStudentIntelligenceTrigger enabled lite={false} />
            <StudentIntelligenceBoundary
              isAr={isAr}
              error={studentIntelError}
              loading={studentIntelLoading}
              onRetry={() => void fetchStudentIntelligence({ lite: false, force: true })}
            >
              {studentIntelLoading && !studentIntelData ? (
                <div className="flex items-center gap-2 py-12 text-slate-600">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {isAr ? "جاري تحميل تميّز الطلاب…" : "Loading student intelligence…"}
                </div>
              ) : null}
              {studentIntelData ? (
                <StudentExcellenceWorkspace
                  isAr={isAr}
                  data={studentIntelData}
                  onSelectStudent={(pid) => setStudentProfilePid(pid)}
                />
              ) : !studentIntelLoading && !studentIntelError ? (
                <p className="text-sm text-slate-500">
                  {isAr ? "لا توجد بيانات طلاب ضمن الفلاتر." : "No student data for current filters."}
                </p>
              ) : null}
            </StudentIntelligenceBoundary>

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

        {activeTab === "general" && allowed === true && !data ? (
          <ExecutiveWorkspaceEmptyState
            isAr={isAr}
            f={f}
            loading={loading}
            onRefresh={() => void fetchData()}
            onClearFilters={() => {
              setF((prev) => clearParticipationFilters(prev));
              setPage(1);
            }}
          />
        ) : null}

        {activeTab === "decisions" && data ? (
          <ExecutiveDecisionWorkspace
            isAr={isAr}
            filterFingerprint={executiveBundle?.filterFingerprint ?? filterKey}
            data={data}
            insights={insights}
            narratives={executiveBundle?.narratives ?? []}
            strategicInsights={executiveBundle?.strategicInsights ?? []}
            precomputed={executiveAiDecisions}
            studentIntelRows={studentIntelData?.byWeightedScore?.slice(0, 15)}
          />
        ) : null}

        {activeTab === "historical" && allowed === true ? (
          <HistoricalTablesWorkspace isAr={isAr} />
        ) : null}

        {activeTab === "general" && data && kpi ? (
          <ParticipationIntelligenceDashboard
            isAr={isAr}
            data={data}
            insights={insights}
            loading={loading}
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            f={f}
            studentIntelData={studentIntelData}
            studentIntelLoading={studentIntelLoading}
            onSelectStudent={setStudentProfilePid}
            onClearFilters={() => {
              setF((prev) => clearParticipationFilters(prev));
              setPage(1);
            }}
            executivePrecomputed={executiveBundle}
            executivePrecomputedMeta={executiveBundleMeta}
          />
        ) : null}

        {activeTab === "focused" ? (
          <div className="space-y-6">
            <ExecutiveRuntimeRecoveryBoundary
              isAr={isAr}
              sectionId="focused-executive-panel"
              onSoftReset={() => {
                setFocusedRuntimeRecoveryKey((n) => n + 1);
                void refreshAll();
              }}
              onFacetRetry={() => void refreshAll()}
            >
            <FocusedExecutiveIntelligencePanel
              key={focusedRuntimeRecoveryKey}
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
                if (!v) setComparePick("");
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
              fetchFocusedFacet={fetchFocusedFacet}
              refreshNonce={focusedRefreshNonce}
              onDecisionReportReady={handleFocusedDecisionReady}
            />

            {focusedDecisionReport ? (
              <div className="print:hidden">
                <CompetitionDecisionWorkspace isAr={isAr} report={focusedDecisionReport} />
              </div>
            ) : null}
            </ExecutiveRuntimeRecoveryBoundary>
          </div>
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
        <ExecutiveRuntimeDebugOverlay />
      </ExecutiveWorkspaceShell>
    </PageContainer>
  );
};

const AdminParticipationAnalyticsPageInner = () => (
  <AnalyticsPerspectiveBridge>
    <AdminParticipationAnalyticsPageContent />
  </AnalyticsPerspectiveBridge>
);

const AdminParticipationAnalyticsPage = () => (
  <Suspense
    fallback={
      <PageContainer>
        <p className="py-12 text-center text-sm text-slate-600">Loading analytics…</p>
      </PageContainer>
    }
  >
    <AnalyticsFilterProvider enableUrlSync>
      <AdminParticipationAnalyticsPageInner />
    </AnalyticsFilterProvider>
  </Suspense>
);

export default AdminParticipationAnalyticsPage;
