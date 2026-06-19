import "server-only";
import {
  getIntelligenceDiagnosticsContext,
} from "@/lib/school-improvement/intelligence-diagnostics-context";
import { validateIntelligenceEnvironmentWithRecovery } from "@/lib/school-improvement/intelligence-environment-recovery";
import { buildFailurePatternRecommendations } from "@/lib/school-improvement/intelligence-failure-patterns";
import { loadRecoveryStats } from "@/lib/school-improvement/intelligence-recovery-events";
import { calculateResilienceScore } from "@/lib/school-improvement/intelligence-resilience-score";
import { probeIntelligenceModelImports } from "@/lib/school-improvement/intelligence-model-validation";
import type {
  IntelligenceSectionReport,
  SchoolImprovementFullDiagnostics,
} from "@/lib/school-improvement/intelligence-diagnostics-types";
import type { IntelligenceSectionHealth } from "@/lib/school-improvement/school-improvement-hardening";
import { processIntelligenceHealthMonitoring } from "@/lib/school-improvement/intelligence-health-monitor";
import { calculateIntelligenceHealthScore } from "@/lib/school-improvement/intelligence-health-score";

const SECTION_SERVICE_MAP: Record<string, string> = {
  school_intelligence_network: "buildSchoolIntelligenceNetwork",
  student_success_graph: "buildStudentSuccessGraph",
  action_engine: "buildActionEngine",
  improvement_plans: "buildImprovementPlans",
  opportunity_recommendations: "buildOpportunityRecommendations",
  student_action_lists: "buildStudentActionLists",
  department_action_plans: "buildDepartmentActionPlans",
  institution_expansion: "buildInstitutionExpansion",
  predictive_scenarios: "buildPredictiveScenarios",
  strategic_roadmap: "buildStrategicRoadmap",
  improvement_tracking: "buildImprovementTracking",
  partnership_indicators: "buildPartnershipIntelligenceDashboard",
  summary: "buildSchoolImprovementSummary",
  build: "buildSchoolImprovementIntelligence",
  route: "GET /api/admin/school-improvement-intelligence",
};

export const buildSectionReports = (
  sections: Record<string, IntelligenceSectionHealth>
): IntelligenceSectionReport[] =>
  Object.entries(sections).map(([section, health]) => ({
    section,
    startedAt: health.startedAt,
    completedAt: health.completedAt,
    durationMs: health.durationMs,
    status: health.status,
    service: health.service || SECTION_SERVICE_MAP[section],
    error: health.error,
    recovery: health.recovery,
    snapshotFallback: health.snapshotFallback,
  }));

export const finalizeIntelligenceDiagnostics = async (input: {
  sections: Record<string, IntelligenceSectionHealth>;
  warnings: string[];
  totalDurationMs: number;
}): Promise<SchoolImprovementFullDiagnostics> => {
  const sectionReports = buildSectionReports(input.sections);
  const healthySections = sectionReports.filter((s) => s.status === "success").map((s) => s.section);
  const unavailableSections = sectionReports
    .filter((s) => s.status === "unavailable")
    .map((s) => s.section);
  const degradedSections = sectionReports.filter((s) => s.status === "degraded").map((s) => s.section);
  const slowSections = sectionReports.filter((s) => s.durationMs > 5000).map((s) => s.section);
  if (degradedSections.length > 0) {
    input.warnings.push(`degraded_sections:${degradedSections.join(",")}`);
  }
  const ctx = getIntelligenceDiagnosticsContext();
  const [environment, modelIssuesProbe, recoveryStats] = await Promise.all([
    validateIntelligenceEnvironmentWithRecovery(),
    probeIntelligenceModelImports(),
    loadRecoveryStats(),
  ]);
  const modelIssues = [...(ctx?.modelIssues ?? []), ...modelIssuesProbe].filter(
    (issue, index, arr) => arr.findIndex((row) => row.name === issue.name && row.kind === issue.kind) === index
  );

  const base: SchoolImprovementFullDiagnostics = {
    generatedAt: new Date().toISOString(),
    totalDurationMs: input.totalDurationMs,
    sections: input.sections,
    sectionReports,
    warnings: input.warnings,
    slow: input.totalDurationMs > 5000,
    slowSections,
    healthySections,
    unavailableSections,
    mongoQueries: ctx?.mongoQueries ?? [],
    aggregationFailures: ctx?.aggregationFailures ?? [],
    modelIssues,
    environment,
    healthScore: calculateIntelligenceHealthScore({
      generatedAt: new Date().toISOString(),
      totalDurationMs: input.totalDurationMs,
      sections: input.sections,
      sectionReports,
      warnings: input.warnings,
      slow: input.totalDurationMs > 5000,
      slowSections,
      healthySections,
      unavailableSections,
      mongoQueries: ctx?.mongoQueries ?? [],
      aggregationFailures: ctx?.aggregationFailures ?? [],
      modelIssues,
      environment,
    }),
  };

  try {
    const monitoring = await processIntelligenceHealthMonitoring(base);
    const recommendations = buildFailurePatternRecommendations(base);
    const resilienceScore = calculateResilienceScore(recoveryStats);
    return {
      ...base,
      healthScore: monitoring.healthScore,
      monitoring: {
        ...monitoring,
        resilienceScore,
        recommendations,
        mostStableServices: recoveryStats.mostStableServices,
        mostUnstableServices: recoveryStats.mostUnstableServices,
        summary: {
          ...monitoring.summary,
          recoveryRatePct: recoveryStats.recoveryRatePct,
          autoHealedIncidents: recoveryStats.autoHealed,
          recoveredServices: recoveryStats.recovered,
        },
      },
      resilienceScore,
      recommendations,
    };
  } catch (error) {
    console.error("[IntelligenceHealthMonitoring] failed", error);
    return {
      ...base,
      resilienceScore: calculateResilienceScore(recoveryStats),
      recommendations: buildFailurePatternRecommendations(base),
    };
  }
};

export const sanitizeDiagnosticsForProduction = (
  diagnostics: SchoolImprovementFullDiagnostics
): SchoolImprovementFullDiagnostics => {
  if (process.env.NODE_ENV !== "production") return diagnostics;

  const sections = Object.fromEntries(
    Object.entries(diagnostics.sections).map(([key, section]) => [
      key,
      {
        ...section,
        stack: undefined,
        error: section.error
          ? { ...section.error, stack: undefined }
          : undefined,
      },
    ])
  );

  return {
    ...diagnostics,
    sections,
    sectionReports: diagnostics.sectionReports.map((report) => ({
      ...report,
      error: report.error ? { ...report.error, stack: undefined } : undefined,
    })),
  };
};
