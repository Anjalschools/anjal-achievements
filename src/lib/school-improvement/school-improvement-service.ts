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
import type { SchoolImprovementPayload } from "@/lib/school-improvement/school-improvement-types";

export const buildSchoolImprovementIntelligence = async (): Promise<SchoolImprovementPayload> => {
  const [intelligence, nodes] = await Promise.all([
    buildSchoolIntelligenceNetwork(),
    buildStudentSuccessGraph(),
  ]);

  const actionEngine = buildActionEngine(intelligence);
  const improvementPlans = buildImprovementPlans(intelligence, actionEngine);
  const opportunityRecommendations = buildOpportunityRecommendations(intelligence);
  const studentActionLists = buildStudentActionLists(intelligence, nodes);
  const departmentActionPlans = buildDepartmentActionPlans(intelligence, actionEngine);
  const institutionExpansion = buildInstitutionExpansion(nodes);
  const predictiveScenarios = buildPredictiveScenarios(intelligence, nodes);
  const strategicRoadmap = buildStrategicRoadmap(actionEngine);
  const generatedAt = new Date().toISOString();
  const improvementTracking = buildImprovementTracking(actionEngine, generatedAt);

  const partnershipDashboard = await buildPartnershipIntelligenceDashboard();

  return {
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
    partnershipIndicators: partnershipDashboard.schoolImprovementIndicators,
    summary: {
      totalActions: actionEngine.length,
      highPriority: actionEngine.filter((a) => a.priority === "high").length,
      proposedCount: improvementTracking.filter((t) => t.status === "proposed").length,
      schoolExcellenceIndex: intelligence.schoolExcellence.excellenceIndex,
    },
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
  };
};
