import type { SchoolIntelligencePayload } from "@/lib/school-intelligence/school-intelligence-types";
import type {
  SchoolIntelligenceApiResponse,
  SchoolIntelligenceBuildStatus,
  SchoolIntelligencePageDiagnostics,
  SchoolIntelligenceSectionKey,
  SchoolIntelligenceSectionStatus,
} from "@/lib/school-intelligence/school-intelligence-page-types";

export const SNAPSHOT_USED_KEY = (diagnostics?: SchoolIntelligencePageDiagnostics) =>
  Boolean(diagnostics?.snapshotFallback);

export const resolveDataSource = (
  status: SchoolIntelligenceBuildStatus,
  snapshotInUse: boolean,
  isAr: boolean
): string => {
  if (snapshotInUse) {
    return isAr ? "نسخة محفوظة (Snapshot)" : "Snapshot";
  }
  if (status === "success") {
    return isAr ? "مباشر (Live)" : "Live";
  }
  if (status === "degraded") {
    return isAr ? "مباشر جزئي (Live)" : "Partial live";
  }
  return isAr ? "غير متاح" : "Unavailable";
};

export const countSlowSignals = (diagnostics?: SchoolIntelligencePageDiagnostics): number => {
  const warningCount =
    diagnostics?.warnings?.filter((w) => w.includes("slow") || w.includes("timeout") || w.includes("aggregation")).length ?? 0;
  const stepCount =
    diagnostics?.steps?.filter((s) => s.detail === "slow_or_timeout" || (s.durationMs ?? 0) > 5000).length ?? 0;
  return Math.max(warningCount, stepCount);
};

/** UI-only display scores derived from the school-intelligence diagnostics payload. */
export const deriveDisplayScoresFromDiagnostics = (
  diagnostics?: SchoolIntelligencePageDiagnostics
): { healthScore: number; resilienceScore: number } => {
  const status = diagnostics?.status ?? "unavailable";
  const snapshotUsed = SNAPSHOT_USED_KEY(diagnostics);
  const slowPenalty = Math.min(25, countSlowSignals(diagnostics) * 8);

  let healthScore =
    status === "success" ? 100 : status === "degraded" ? 72 : 28;
  healthScore = Math.max(0, healthScore - slowPenalty);

  let resilienceScore = snapshotUsed ? 82 : status === "success" ? 96 : status === "degraded" ? 58 : 18;
  if (diagnostics?.steps?.some((step) => step.step === "snapshot_fallback")) {
    resilienceScore = Math.max(resilienceScore, 75);
  }

  return { healthScore, resilienceScore };
};

export const resolveLastSuccessfulUpdate = (
  diagnostics?: SchoolIntelligencePageDiagnostics,
  intelligence?: SchoolIntelligencePayload | null,
  snapshotInUse = false
): string | null => {
  if (snapshotInUse) {
    return (
      diagnostics?.snapshotMetadata?.capturedAt ||
      intelligence?.generatedAt ||
      diagnostics?.buildTimestamp ||
      diagnostics?.generatedAt ||
      null
    );
  }
  return diagnostics?.buildTimestamp || diagnostics?.generatedAt || null;
};

export const resolveSnapshotTimestamp = (
  diagnostics?: SchoolIntelligencePageDiagnostics,
  intelligence?: SchoolIntelligencePayload | null,
  snapshotInUse = false
): string | null => {
  if (!snapshotInUse) return null;
  return (
    diagnostics?.snapshotMetadata?.capturedAt ||
    intelligence?.generatedAt ||
    null
  );
};

const sectionHasData = (key: SchoolIntelligenceSectionKey, data: SchoolIntelligencePayload): boolean => {
  switch (key) {
    case "summary":
      return data.schoolExcellence.excellenceIndex > 0 || data.studentSuccessGraph.totalNodes > 0;
    case "strategic_insights":
      return data.strategicInsights.length > 0;
    case "student_success":
      return data.studentSuccessGraph.topStudents.length > 0;
    case "department_excellence":
      return data.departmentExcellence.length > 0;
    case "talent_discovery":
      return data.talentDiscovery.length > 0;
    case "interventions":
      return data.interventions.length > 0;
    case "opportunity_mapping":
      return data.opportunityMapping.length > 0;
    case "longitudinal_growth":
      return data.longitudinalGrowth.length > 0;
    default:
      return false;
  }
};

export const resolveSectionStatus = (
  key: SchoolIntelligenceSectionKey,
  data: SchoolIntelligencePayload | null,
  _globalStatus: SchoolIntelligenceBuildStatus,
  snapshotUsed: boolean
): SchoolIntelligenceSectionStatus => {
  if (!data || !sectionHasData(key, data)) return "unavailable";
  if (snapshotUsed) return "snapshot";
  return "available";
};

export const buildSectionStatusMap = (
  data: SchoolIntelligencePayload | null,
  globalStatus: SchoolIntelligenceBuildStatus,
  snapshotUsed: boolean
): Record<SchoolIntelligenceSectionKey, SchoolIntelligenceSectionStatus> => {
  const keys: SchoolIntelligenceSectionKey[] = [
    "summary",
    "strategic_insights",
    "student_success",
    "department_excellence",
    "talent_discovery",
    "interventions",
    "opportunity_mapping",
    "longitudinal_growth",
  ];
  return Object.fromEntries(
    keys.map((key) => [key, resolveSectionStatus(key, data, globalStatus, snapshotUsed)])
  ) as Record<SchoolIntelligenceSectionKey, SchoolIntelligenceSectionStatus>;
};

export const countSectionsByStatus = (
  map: Record<SchoolIntelligenceSectionKey, SchoolIntelligenceSectionStatus>
) => ({
  available: Object.values(map).filter((s) => s === "available").length,
  snapshot: Object.values(map).filter((s) => s === "snapshot").length,
  unavailable: Object.values(map).filter((s) => s === "unavailable").length,
});

export const sectionStatusLabel = (status: SchoolIntelligenceSectionStatus, isAr: boolean) => {
  if (status === "available") return isAr ? "متاح" : "Available";
  if (status === "snapshot") return isAr ? "نسخة محفوظة" : "Snapshot";
  return isAr ? "غير متاح" : "Unavailable";
};

export const systemStatusLabel = (status: SchoolIntelligenceBuildStatus, isAr: boolean) => {
  if (status === "success") return isAr ? "يعمل بشكل طبيعي" : "Operational";
  if (status === "degraded") return isAr ? "يعمل بنسخة محفوظة" : "Degraded";
  return isAr ? "غير متاح" : "Unavailable";
};

export const parseSchoolIntelligenceResponse = (json: SchoolIntelligenceApiResponse) => {
  const status: SchoolIntelligenceBuildStatus =
    json.status === "degraded" || json.status === "unavailable" ? json.status : "success";
  const diagnostics = json.diagnostics;
  const snapshotUsed = SNAPSHOT_USED_KEY(diagnostics);
  return { status, diagnostics, snapshotUsed, intelligence: json.intelligence ?? null };
};
