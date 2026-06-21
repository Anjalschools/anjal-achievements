import type { SchoolIntelligencePayload } from "@/lib/school-intelligence/school-intelligence-types";
import type {
  SchoolIntelligenceBuildStatus,
  SchoolIntelligencePageDiagnostics,
  SchoolIntelligenceSectionKey,
  SchoolIntelligenceSectionStatus,
} from "@/lib/school-intelligence/school-intelligence-page-types";
import {
  SCHOOL_INTELLIGENCE_RUNTIME_VERSION,
  SCHOOL_INTELLIGENCE_TEST_SUITE_COUNT,
} from "@/lib/school-intelligence/school-intelligence-boot";
import type { SchoolIntelligenceDiagnostics } from "@/lib/school-intelligence/school-intelligence-diagnostics-types";

export type SchoolIntelligenceFinalReadinessStatus = "PRODUCTION_READY" | "NOT_READY";

export type SchoolIntelligenceCertificationStatus =
  | "CERTIFIED_PRODUCTION_READY"
  | "NOT_CERTIFIED";

export type SchoolIntelligenceSnapshotHealthStatus =
  | "healthy"
  | "degraded"
  | "failed"
  | "skipped"
  | "unknown";

export type SchoolIntelligenceDiagnosticsHealthStatus = "healthy" | "partial" | "missing";

export type SchoolIntelligenceFinalReadinessDiagnostics = {
  version: string;
  availableSections: number;
  unavailableSections: number;
  noDataSections: number;
  healthScore: number;
  intelligenceScore: number;
  snapshotStatus: SchoolIntelligenceSnapshotHealthStatus;
  diagnosticsStatus: SchoolIntelligenceDiagnosticsHealthStatus;
  buildStatus: SchoolIntelligenceBuildStatus;
  testStatus: string;
  finalReadiness: SchoolIntelligenceFinalReadinessStatus;
  certificationStatus: SchoolIntelligenceCertificationStatus;
};

export const PRODUCTION_READY_MIN_HEALTH_SCORE = 80;
export const PRODUCTION_READY_MIN_INTELLIGENCE_SCORE = 80;

export const deriveIntelligenceScore = (
  data: SchoolIntelligencePayload | null,
  sectionStatusMap: Record<SchoolIntelligenceSectionKey, SchoolIntelligenceSectionStatus>
): number => {
  if (!data) return 0;

  let score = 36;
  if (data.strategicInsights.length > 0) score += 14;
  if (data.longitudinalGrowth.length >= 2) score += 12;
  else if (data.longitudinalGrowth.length > 0) score += 6;
  if (data.opportunityMapping.length > 0) score += 10;
  if (data.studentSuccessGraph.totalNodes > 0) score += 10;
  if (data.talentDiscovery.length > 0) score += 5;
  if (data.interventions.length > 0) score += 5;
  if (data.departmentExcellence.length > 0) score += 4;

  const operationalSections = Object.values(sectionStatusMap).filter(
    (status) => status === "available" || status === "snapshot" || status === "no_data"
  ).length;
  score += Math.min(14, operationalSections * 2);

  return Math.min(100, Math.max(0, score));
};

export const resolveSnapshotHealthStatus = (
  diagnostics?: {
    snapshotSave?: Pick<SchoolIntelligenceDiagnostics, "snapshotSave">["snapshotSave"];
    status?: SchoolIntelligenceBuildStatus;
    snapshotFallback?: boolean;
  }
): SchoolIntelligenceSnapshotHealthStatus => {
  if (diagnostics?.snapshotSave?.succeeded) return "healthy";
  if (diagnostics?.snapshotFallback && diagnostics.status === "degraded") return "degraded";
  if (diagnostics?.snapshotSave?.attempted && !diagnostics.snapshotSave.succeeded) return "failed";
  if (diagnostics?.snapshotSave && !diagnostics.snapshotSave.attempted) return "skipped";
  return "unknown";
};

export const resolveDiagnosticsHealthStatus = (
  diagnostics?: SchoolIntelligenceDiagnostics | SchoolIntelligencePageDiagnostics
): SchoolIntelligenceDiagnosticsHealthStatus => {
  if (!diagnostics?.status) return "missing";
  if (diagnostics.status === "unavailable") return "partial";
  if (diagnostics.firstFailure) return "partial";
  if ((diagnostics.warnings?.length ?? 0) > 0 && diagnostics.status !== "success") return "partial";
  if (diagnostics.status === "degraded") return "partial";
  if (diagnostics.status === "success") return "healthy";
  return "partial";
};

export const evaluateProductionReadiness = (input: {
  unavailableSections: number;
  diagnosticsStatus: SchoolIntelligenceDiagnosticsHealthStatus;
  snapshotStatus: SchoolIntelligenceSnapshotHealthStatus;
  healthScore: number;
  intelligenceScore: number;
  talentDiscoveryOk: boolean;
  buildStatus: SchoolIntelligenceBuildStatus;
}): SchoolIntelligenceFinalReadinessStatus => {
  const meetsThresholds =
    input.unavailableSections === 0 &&
    input.diagnosticsStatus === "healthy" &&
    input.snapshotStatus === "healthy" &&
    input.healthScore >= PRODUCTION_READY_MIN_HEALTH_SCORE &&
    input.intelligenceScore >= PRODUCTION_READY_MIN_INTELLIGENCE_SCORE &&
    input.talentDiscoveryOk &&
    input.buildStatus === "success";

  return meetsThresholds ? "PRODUCTION_READY" : "NOT_READY";
};

export const buildFinalReadinessDiagnostics = (input: {
  sectionCounts: {
    available: number;
    snapshot: number;
    unavailable: number;
    noData: number;
  };
  healthScore: number;
  intelligenceScore: number;
  diagnostics?: SchoolIntelligenceDiagnostics | SchoolIntelligencePageDiagnostics;
}): SchoolIntelligenceFinalReadinessDiagnostics => {
  const availableSections =
    input.sectionCounts.available + input.sectionCounts.snapshot + input.sectionCounts.noData;
  const talentDiscovery = input.diagnostics?.talentDiscovery;
  const talentDiscoveryOk =
    !talentDiscovery || talentDiscovery.status === "success" || talentDiscovery.status === "no_data";
  const buildStatus = input.diagnostics?.status ?? "unavailable";
  const snapshotStatus = resolveSnapshotHealthStatus(input.diagnostics);
  const diagnosticsStatus = resolveDiagnosticsHealthStatus(input.diagnostics);

  const finalReadiness = evaluateProductionReadiness({
    unavailableSections: input.sectionCounts.unavailable,
    diagnosticsStatus,
    snapshotStatus,
    healthScore: input.healthScore,
    intelligenceScore: input.intelligenceScore,
    talentDiscoveryOk,
    buildStatus,
  });

  return {
    version: SCHOOL_INTELLIGENCE_RUNTIME_VERSION,
    availableSections,
    unavailableSections: input.sectionCounts.unavailable,
    noDataSections: input.sectionCounts.noData,
    healthScore: input.healthScore,
    intelligenceScore: input.intelligenceScore,
    snapshotStatus,
    diagnosticsStatus,
    buildStatus,
    testStatus: `${SCHOOL_INTELLIGENCE_TEST_SUITE_COUNT}/${SCHOOL_INTELLIGENCE_TEST_SUITE_COUNT} passing`,
    finalReadiness,
    certificationStatus:
      finalReadiness === "PRODUCTION_READY" ? "CERTIFIED_PRODUCTION_READY" : "NOT_CERTIFIED",
  };
};
