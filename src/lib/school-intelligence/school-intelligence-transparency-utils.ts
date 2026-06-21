import type { SchoolIntelligencePayload } from "@/lib/school-intelligence/school-intelligence-types";
import type {
  SchoolIntelligenceBuildStatus,
  SchoolIntelligencePageDiagnostics,
  SchoolIntelligenceSectionKey,
  SchoolIntelligenceSectionStatus,
} from "@/lib/school-intelligence/school-intelligence-page-types";
import {
  buildSectionStatusMap,
  countSectionsByStatus,
  countSlowSignals,
} from "@/lib/school-intelligence/school-intelligence-page-utils";
import {
  buildFinalReadinessDiagnostics,
  deriveIntelligenceScore,
} from "@/lib/school-intelligence/school-intelligence-final-readiness";

export type SectionEmptyKind = "no_data" | "failure" | "snapshot";

export type RootCauseSummary = {
  failingService: string;
  errorCategory: string;
  firstFailureTime: string | null;
  lastRetryTime: string | null;
  snapshotAvailable: boolean;
};

export type HealthBreakdownItem = {
  labelAr: string;
  labelEn: string;
  penalty: number;
};

export type HealthScoreBreakdown = {
  total: number;
  base: number;
  items: HealthBreakdownItem[];
};

export type RecoveryHistoryView = {
  lastAttemptAt: string | null;
  attemptCount: number;
  recoverySucceeded: boolean;
  recoveryDurationMs: number | null;
  recoveryLabelAr: string;
  recoveryLabelEn: string;
};

export type SnapshotVisibility = {
  available: boolean;
  inUse: boolean;
  timestamp: string | null;
  ageLabelAr: string;
  ageLabelEn: string;
};

export type MonitoringRecoveryPayload = {
  recoveries?: Array<{ resolvedAt: string; downtimeMs: number; messageAr?: string; messageEn?: string }>;
  summary?: { recoveryCount?: number; recoveryRatePct?: number; autoHealedIncidents?: number };
};

/** Single source of truth — never infer from intelligence.generatedAt. */
export const resolveSnapshotAvailable = (diagnostics?: SchoolIntelligencePageDiagnostics): boolean =>
  diagnostics?.snapshotFallback === true ||
  diagnostics?.snapshotUsed === true ||
  diagnostics?.snapshotMetadata?.exists === true;

export const resolveSnapshotInUse = (diagnostics?: SchoolIntelligencePageDiagnostics): boolean =>
  diagnostics?.snapshotFallback === true || diagnostics?.snapshotUsed === true;

export const resolveSnapshotTimestampFromDiagnostics = (
  diagnostics?: SchoolIntelligencePageDiagnostics,
  intelligence?: SchoolIntelligencePayload | null
): string | null => {
  if (!resolveSnapshotInUse(diagnostics)) return null;
  return diagnostics?.snapshotMetadata?.capturedAt ?? intelligence?.generatedAt ?? null;
};

export const SECTION_LABELS: Record<SchoolIntelligenceSectionKey, { ar: string; en: string }> = {
  summary: { ar: "ملخص المؤشرات", en: "Indicator summary" },
  strategic_insights: { ar: "الرؤى الاستراتيجية", en: "Strategic insights" },
  student_success: { ar: "نجاح الطلاب SSI", en: "Student success SSI" },
  department_excellence: { ar: "تميز الأقسام", en: "Department excellence" },
  talent_discovery: { ar: "اكتشاف المواهب", en: "Talent discovery" },
  interventions: { ar: "محرك التدخل", en: "Intervention engine" },
  opportunity_mapping: { ar: "خريطة الفرص", en: "Opportunity mapping" },
  longitudinal_growth: { ar: "النمو الطولي", en: "Longitudinal growth" },
};

export const reclassifySystemStatus = (
  apiStatus: SchoolIntelligenceBuildStatus,
  availableSections: number,
  hasDiagnostics: boolean
): SchoolIntelligenceBuildStatus => {
  if (availableSections === 0) return "unavailable";
  if (apiStatus === "success") return "success";
  if (apiStatus === "unavailable" && hasDiagnostics) return "degraded";
  return "degraded";
};

const SERVICE_LABELS: Record<string, { ar: string; en: string }> = {
  achievement_intelligence: { ar: "Achievement Intelligence", en: "Achievement Intelligence" },
  buildSchoolIntelligenceNetwork: { ar: "School Intelligence Network", en: "School Intelligence Network" },
  mongodb: { ar: "MongoDB", en: "MongoDB" },
};

const parseFailingService = (diagnostics?: SchoolIntelligencePageDiagnostics): string => {
  const source = diagnostics?.timeoutSource || "";
  if (source.includes("achievement")) return SERVICE_LABELS.achievement_intelligence.en;
  if (source) return source;

  const warnings = diagnostics?.warnings ?? [];
  if (warnings.some((w) => w.includes("Achievement") || w.includes("buildStudentIntelligence"))) {
    return SERVICE_LABELS.achievement_intelligence.en;
  }
  if (warnings.some((w) => w.includes("mongo") || w.includes("Mongo"))) {
    return SERVICE_LABELS.mongodb.en;
  }
  const mainStep = diagnostics?.steps?.find((s) => s.detail === "slow_or_timeout" || s.durationMs > 8000);
  if (mainStep?.step.includes("build")) return SERVICE_LABELS.buildSchoolIntelligenceNetwork.en;
  return "School Intelligence";
};

const parseErrorCategory = (
  diagnostics?: SchoolIntelligencePageDiagnostics,
  snapshotAvailable?: boolean
): string => {
  if (diagnostics?.firstFailure?.failureClassification) {
    return diagnostics.firstFailure.failureClassification;
  }
  if (diagnostics?.firstFailure?.errorName) {
    return diagnostics.firstFailure.errorName;
  }
  const warnings = diagnostics?.warnings ?? [];
  if (warnings.some((w) => w.includes("aggregation") || w.includes("timeout") || w.includes("exceeded"))) {
    return "Aggregation Timeout";
  }
  if (warnings.some((w) => w.includes("slow") || w.includes("slow_or_timeout"))) {
    return "MongoDB Slow Query";
  }
  if (!snapshotAvailable && diagnostics?.status === "unavailable") {
    return "Snapshot Missing";
  }
  if (warnings.some((w) => w.includes("snapshot_save_failed"))) {
    return "Snapshot Save Failed";
  }
  if (warnings.length > 0) return "Service Degradation";
  return diagnostics?.status === "degraded" ? "Partial Degradation" : "Unknown";
};

export const buildRootCauseSummary = (diagnostics?: SchoolIntelligencePageDiagnostics): RootCauseSummary => {
  const snapshotAvailable = resolveSnapshotAvailable(diagnostics);
  const snapshotStep = diagnostics?.steps?.find((s) => s.step === "snapshot_fallback");
  const firstFailure = diagnostics?.firstFailure;

  return {
    failingService: firstFailure?.service || parseFailingService(diagnostics),
    errorCategory: parseErrorCategory(diagnostics, snapshotAvailable),
    firstFailureTime: firstFailure?.timestamp ?? diagnostics?.generatedAt ?? diagnostics?.buildTimestamp ?? null,
    lastRetryTime: diagnostics?.buildTimestamp ?? (snapshotStep ? diagnostics?.generatedAt ?? null : null),
    snapshotAvailable,
  };
};

export const resolveSectionEmptyKind = (
  sectionStatus: SchoolIntelligenceSectionStatus,
  globalStatus: SchoolIntelligenceBuildStatus,
  diagnostics?: SchoolIntelligencePageDiagnostics
): SectionEmptyKind | null => {
  if (sectionStatus === "available") return null;
  if (sectionStatus === "snapshot") return "snapshot";
  if (sectionStatus === "no_data") return "no_data";

  const hasFailure =
    globalStatus === "unavailable" ||
    (diagnostics?.warnings?.length ?? 0) > 0 ||
    diagnostics?.steps?.some((s) => s.detail === "slow_or_timeout" || s.step === "snapshot_fallback");

  return hasFailure ? "failure" : "no_data";
};

export const formatSnapshotAge = (timestamp: string | null, isAr: boolean): { ar: string; en: string } => {
  if (!timestamp) {
    return { ar: "غير معروف", en: "Unknown" };
  }
  const ms = Date.now() - new Date(timestamp).getTime();
  if (Number.isNaN(ms) || ms < 0) {
    return { ar: "غير معروف", en: "Unknown" };
  }
  const minutes = Math.floor(ms / 60_000);
  const hours = Math.floor(ms / 3_600_000);
  const days = Math.floor(ms / 86_400_000);

  if (days >= 1) {
    return { ar: `منذ ${days} ${days === 1 ? "يوم" : "أيام"}`, en: `${days} day(s) ago` };
  }
  if (hours >= 1) {
    return { ar: `منذ ${hours} ${hours === 1 ? "ساعة" : "ساعات"}`, en: `${hours} hour(s) ago` };
  }
  return { ar: `منذ ${Math.max(1, minutes)} ${minutes === 1 ? "دقيقة" : "دقائق"}`, en: `${Math.max(1, minutes)} min ago` };
};

export const buildSnapshotVisibility = (
  diagnostics?: SchoolIntelligencePageDiagnostics,
  intelligence?: SchoolIntelligencePayload | null
): SnapshotVisibility => {
  const available = resolveSnapshotAvailable(diagnostics);
  const inUse = resolveSnapshotInUse(diagnostics);
  const timestamp = resolveSnapshotTimestampFromDiagnostics(diagnostics, intelligence);
  const age = formatSnapshotAge(timestamp, true);

  return {
    available,
    inUse,
    timestamp,
    ageLabelAr: available ? age.ar : "—",
    ageLabelEn: available ? age.en : "—",
  };
};

export const buildHealthScoreBreakdown = (
  diagnostics?: SchoolIntelligencePageDiagnostics,
  sectionCounts?: { available: number; snapshot: number; noData: number; unavailable: number }
): HealthScoreBreakdown => {
  const counts = sectionCounts ?? { available: 0, snapshot: 0, noData: 0, unavailable: 0 };
  const slowCount = countSlowSignals(diagnostics);
  const snapshotAvailable = resolveSnapshotAvailable(diagnostics);
  const serviceWarnings = (diagnostics?.warnings ?? []).filter(
    (w) => !w.includes("slow") && !w.includes("aggregation") && !w.includes("timeout")
  ).length;

  const unavailablePenalty = Math.min(40, counts.unavailable * 8);
  const slowPenalty = Math.min(15, slowCount * 8);
  const snapshotPenalty = !snapshotAvailable && diagnostics?.status !== "success" ? 10 : 0;
  const servicePenalty = Math.min(7, serviceWarnings * 7);

  const items: HealthBreakdownItem[] = [];
  if (unavailablePenalty > 0) {
    items.push({ labelAr: "أقسام معطلة", labelEn: "Disabled sections", penalty: unavailablePenalty });
  }
  if (slowPenalty > 0) {
    items.push({ labelAr: "استعلامات بطيئة", labelEn: "Slow queries", penalty: slowPenalty });
  }
  if (snapshotPenalty > 0) {
    items.push({ labelAr: "Snapshot مفقود", labelEn: "Missing snapshot", penalty: snapshotPenalty });
  }
  if (servicePenalty > 0) {
    items.push({ labelAr: "خدمات غير متاحة", labelEn: "Unavailable services", penalty: servicePenalty });
  }

  const base = 100;
  const total = Math.max(0, base - items.reduce((sum, item) => sum + item.penalty, 0));

  return { total, base, items };
};

export const buildRecoveryHistoryFromDiagnostics = (
  diagnostics?: SchoolIntelligencePageDiagnostics
): RecoveryHistoryView => {
  const snapshotStep = diagnostics?.steps?.find((s) => s.step === "snapshot_fallback");
  const snapshotInUse = resolveSnapshotInUse(diagnostics);
  const retrySignals = (diagnostics?.warnings?.length ?? 0) + (diagnostics?.steps?.length ?? 0);
  const recoverySucceeded = snapshotInUse || diagnostics?.status === "success";

  return {
    lastAttemptAt: diagnostics?.buildTimestamp ?? diagnostics?.generatedAt ?? null,
    attemptCount: Math.max(1, retrySignals),
    recoverySucceeded,
    recoveryDurationMs: snapshotStep?.durationMs ?? diagnostics?.totalDurationMs ?? null,
    recoveryLabelAr: recoverySucceeded ? "نجاح الإصلاح" : "فشل الإصلاح",
    recoveryLabelEn: recoverySucceeded ? "Recovery succeeded" : "Recovery failed",
  };
};

export const mergeRecoveryHistoryWithMonitoring = (
  diagnosticsView: RecoveryHistoryView,
  monitoring?: MonitoringRecoveryPayload | null
): RecoveryHistoryView => {
  if (!monitoring?.recoveries?.length && !monitoring?.summary) return diagnosticsView;

  const latest = monitoring.recoveries?.[0];
  return {
    lastAttemptAt: latest?.resolvedAt ?? diagnosticsView.lastAttemptAt,
    attemptCount: monitoring.summary?.recoveryCount ?? diagnosticsView.attemptCount,
    recoverySucceeded:
      (monitoring.summary?.recoveryRatePct ?? 0) >= 50 || diagnosticsView.recoverySucceeded,
    recoveryDurationMs: latest?.downtimeMs ?? diagnosticsView.recoveryDurationMs,
    recoveryLabelAr:
      (monitoring.summary?.recoveryRatePct ?? 0) >= 50
        ? "نجاح الإصلاح"
        : diagnosticsView.recoveryLabelAr,
    recoveryLabelEn:
      (monitoring.summary?.recoveryRatePct ?? 0) >= 50
        ? "Recovery succeeded"
        : diagnosticsView.recoveryLabelEn,
  };
};

export const buildDiagnosticExpanderSections = (
  sectionStatusMap: Record<SchoolIntelligenceSectionKey, SchoolIntelligenceSectionStatus>,
  diagnostics?: SchoolIntelligencePageDiagnostics
) => {
  const failedSections = (Object.entries(sectionStatusMap) as Array<[SchoolIntelligenceSectionKey, SchoolIntelligenceSectionStatus]>)
    .filter(([, status]) => status === "unavailable")
    .map(([key]) => SECTION_LABELS[key].ar);

  const slowQueries =
    diagnostics?.steps?.filter((s) => s.detail === "slow_or_timeout" || s.durationMs > 5000).map((s) => s.step) ??
    [];

  const aggregationFailures =
    diagnostics?.warnings?.filter((w) => w.includes("aggregation") || w.includes("timeout")) ?? [];

  const environmentWarnings =
    diagnostics?.warnings?.filter(
      (w) => w.includes("env") || w.includes("snapshot_save") || w.includes("connection")
    ) ?? [];

  return { failedSections, slowQueries, aggregationFailures, environmentWarnings };
};

export const resolveTransparentPageState = (
  apiStatus: SchoolIntelligenceBuildStatus,
  data: SchoolIntelligencePayload | null,
  diagnostics?: SchoolIntelligencePageDiagnostics,
  snapshotInUse = false
) => {
  const snapshotAvailable = resolveSnapshotAvailable(diagnostics);
  const provisionalMap = buildSectionStatusMap(data, apiStatus, snapshotInUse);
  const provisionalCounts = countSectionsByStatus(provisionalMap);
  const availableSections =
    provisionalCounts.available + provisionalCounts.snapshot + provisionalCounts.noData;
  const hasDiagnostics = Boolean(diagnostics);
  const status = reclassifySystemStatus(apiStatus, availableSections, hasDiagnostics);
  const sectionStatusMap = buildSectionStatusMap(data, status, snapshotInUse);
  const sectionCounts = countSectionsByStatus(sectionStatusMap);
  const healthBreakdown = buildHealthScoreBreakdown(diagnostics, sectionCounts);
  const intelligenceScore = deriveIntelligenceScore(data, sectionStatusMap);
  const finalReadiness = buildFinalReadinessDiagnostics({
    sectionCounts,
    healthScore: healthBreakdown.total,
    intelligenceScore,
    diagnostics,
  });
  const rootCause = buildRootCauseSummary(diagnostics);
  const snapshotVisibility = buildSnapshotVisibility(diagnostics, data);
  const recoveryHistory = buildRecoveryHistoryFromDiagnostics(diagnostics);

  return {
    status,
    sectionStatusMap,
    sectionCounts,
    availableSections,
    snapshotAvailable,
    snapshotInUse,
    healthBreakdown,
    rootCause,
    snapshotVisibility,
    recoveryHistory,
    intelligenceScore,
    finalReadiness,
  };
};
