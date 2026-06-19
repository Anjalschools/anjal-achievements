import "server-only";
import { buildSchoolIntelligenceNetwork } from "@/lib/school-intelligence/school-intelligence-service";
import { buildStudentSuccessGraph } from "@/lib/school-intelligence/student-success-graph";
import { buildActionEngine } from "@/lib/school-improvement/action-engine";
import { buildImprovementPlans } from "@/lib/school-improvement/improvement-plan-builder";
import { buildOpportunityRecommendations } from "@/lib/school-improvement/opportunity-recommendation-engine";
import { buildStudentActionLists } from "@/lib/school-improvement/student-action-lists";
import { buildDepartmentActionPlans } from "@/lib/school-improvement/department-action-plans";
import { buildInstitutionExpansion } from "@/lib/school-improvement/institution-expansion-engine";
import { buildPredictiveScenarios } from "@/lib/school-improvement/predictive-improvement";
import { buildStrategicRoadmap } from "@/lib/school-improvement/strategic-roadmap";
import { buildImprovementTracking } from "@/lib/school-improvement/improvement-tracking";
import { buildPartnershipIntelligenceDashboard } from "@/lib/partnerships/institution-performance-intelligence-service";
import {
  createEmptySchoolIntelligencePayload,
  DEFAULT_PARTNERSHIP_INDICATORS,
  EMPTY_STUDENT_NODES,
} from "@/lib/school-improvement/school-improvement-defaults";
import { runWithIntelligenceDiagnostics } from "@/lib/school-improvement/intelligence-diagnostics-context";
import {
  finalizeIntelligenceDiagnostics,
} from "@/lib/school-improvement/intelligence-diagnostics-builder";
import { saveIntelligenceSnapshot } from "@/lib/school-improvement/intelligence-snapshot-store";
import type { SchoolImprovementFullDiagnostics } from "@/lib/school-improvement/intelligence-diagnostics-types";
import {
  logIntelligenceSection,
  runIntelligenceSection,
  type IntelligenceSectionHealth,
} from "@/lib/school-improvement/school-improvement-hardening";
import type { SchoolImprovementPayload } from "@/lib/school-improvement/school-improvement-types";

export type SchoolImprovementBuildResult = {
  payload: SchoolImprovementPayload;
  diagnostics: SchoolImprovementFullDiagnostics;
};

const buildSchoolImprovementIntelligenceInner = async (): Promise<SchoolImprovementBuildResult> => {
  const buildStarted = Date.now();
  const sectionHealth: Record<string, IntelligenceSectionHealth> = {};
  const warnings: string[] = [];

  logIntelligenceSection("[SchoolImprovement]", "build", "start");

  const run = <T>(
    section: string,
    logTag: string,
    fn: () => Promise<T> | T,
    fallback: T,
    opts?: { isEmpty?: (value: T) => boolean; service?: string }
  ) =>
    runIntelligenceSection({
      section,
      logTag,
      fn,
      fallback,
      sectionHealth,
      warnings,
      service: opts?.service,
      isEmpty: opts?.isEmpty,
    });

  const [intelligence, nodes] = await Promise.all([
    run(
      "school_intelligence_network",
      "[SchoolImprovement]",
      () => buildSchoolIntelligenceNetwork(),
      createEmptySchoolIntelligencePayload(),
      { isEmpty: (value) => value.studentSuccessGraph.totalNodes === 0 }
    ),
    run(
      "student_success_graph",
      "[SchoolImprovement]",
      () => buildStudentSuccessGraph().then((result) => result.nodes),
      EMPTY_STUDENT_NODES,
      { isEmpty: (value) => value.length === 0 }
    ),
  ]);

  const actionEngine = await run(
    "action_engine",
    "[ImprovementMetrics]",
    () => buildActionEngine(intelligence),
    [],
    { isEmpty: (value) => value.length === 0 }
  );

  const improvementPlans = await run(
    "improvement_plans",
    "[ImprovementMetrics]",
    () => buildImprovementPlans(intelligence, actionEngine),
    [],
    { isEmpty: (value) => value.length === 0 }
  );

  const opportunityRecommendations = await run(
    "opportunity_recommendations",
    "[RecommendationEngine]",
    () => buildOpportunityRecommendations(intelligence),
    [],
    { isEmpty: (value) => value.length === 0 }
  );

  const studentActionLists = await run(
    "student_action_lists",
    "[ImprovementMetrics]",
    () => buildStudentActionLists(intelligence, nodes),
    [],
    { isEmpty: (value) => value.length === 0 }
  );

  const departmentActionPlans = await run(
    "department_action_plans",
    "[ImprovementMetrics]",
    () => buildDepartmentActionPlans(intelligence, actionEngine),
    [],
    { isEmpty: (value) => value.length === 0 }
  );

  const institutionExpansion = await run(
    "institution_expansion",
    "[RecommendationEngine]",
    () => buildInstitutionExpansion(nodes),
    [],
    { isEmpty: (value) => value.length === 0 }
  );

  const predictiveScenarios = await run(
    "predictive_scenarios",
    "[ExecutiveIntelligence]",
    () => buildPredictiveScenarios(intelligence, nodes),
    [],
    { isEmpty: (value) => value.length === 0 }
  );

  const strategicRoadmap = await run(
    "strategic_roadmap",
    "[ExecutiveIntelligence]",
    () => buildStrategicRoadmap(actionEngine),
    [],
    { isEmpty: (value) => value.length === 0 }
  );

  const generatedAt = new Date().toISOString();

  const improvementTracking = await run(
    "improvement_tracking",
    "[ImprovementMetrics]",
    () => buildImprovementTracking(actionEngine, generatedAt),
    [],
    { isEmpty: (value) => value.length === 0 }
  );

  const partnershipIndicators = await run(
    "partnership_indicators",
    "[ExecutiveIntelligence]",
    async () => {
      const dashboard = await buildPartnershipIntelligenceDashboard();
      return dashboard.schoolImprovementIndicators;
    },
    DEFAULT_PARTNERSHIP_INDICATORS,
    {
      service: "buildPartnershipIntelligenceDashboard",
      isEmpty: (value) => Object.values(value).every((metric) => metric === 0),
    }
  );

  const summary = await run(
    "summary",
    "[SchoolImprovement]",
    () => ({
      totalActions: actionEngine.length,
      highPriority: actionEngine.filter((a) => a.priority === "high").length,
      proposedCount: improvementTracking.filter((t) => t.status === "proposed").length,
      schoolExcellenceIndex: intelligence.schoolExcellence.excellenceIndex,
    }),
    {
      totalActions: 0,
      highPriority: 0,
      proposedCount: 0,
      schoolExcellenceIndex: 0,
    }
  );

  const totalDurationMs = Date.now() - buildStarted;
  sectionHealth.build = {
    status: "success",
    startedAt: new Date(buildStarted).toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: totalDurationMs,
    service: "buildSchoolImprovementIntelligence",
  };

  logIntelligenceSection("[SchoolImprovement]", "build", "success", {
    durationMs: totalDurationMs,
    message: totalDurationMs > 5000 ? "total build exceeded 5000ms" : undefined,
  });

  const diagnostics = await finalizeIntelligenceDiagnostics({
    sections: sectionHealth,
    warnings,
    totalDurationMs,
  });

  const payload: SchoolImprovementPayload = {
    generatedAt,
    actionEngine,
    improvementPlans,
    opportunityRecommendations,
    studentActionLists,
    departmentActionPlans,
    institutionExpansion,
    predictiveScenarios,
    strategicRoadmap,
    improvementTracking,
    partnershipIndicators,
    summary,
    governance: {
      readOnly: true,
      explainable: true,
      deterministic: true,
      noAutoExecution: true,
      dataSources: [
        "buildSchoolIntelligenceNetwork",
        "buildStudentSuccessGraph",
        "strategicInsights",
        "interventions",
        "opportunityMapping",
        "departmentExcellence",
        "institutionPerformanceIntelligence",
      ],
    },
    sectionHealth,
  };

  await saveIntelligenceSnapshot({
    key: "school_improvement_payload",
    domain: "school_improvement",
    kind: "full_payload",
    payload,
  });

  return { payload, diagnostics };
};

export const buildSchoolImprovementIntelligence = async (): Promise<SchoolImprovementBuildResult> =>
  runWithIntelligenceDiagnostics(buildSchoolImprovementIntelligenceInner);
