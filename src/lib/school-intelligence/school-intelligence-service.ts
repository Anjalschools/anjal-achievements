import "server-only";
import { buildStudentSuccessGraph } from "@/lib/school-intelligence/student-success-graph";
import { buildDepartmentExcellenceIndex } from "@/lib/school-intelligence/department-excellence-index";
import { buildSchoolExcellenceIndex } from "@/lib/school-intelligence/school-excellence-index";
import {
  buildLongitudinalGrowth,
  computeYearOverYearGrowthPct,
} from "@/lib/school-intelligence/longitudinal-growth";
import { buildGrowthTrendsIntelligence } from "@/lib/school-intelligence/growth-trends-intelligence";
import { buildTalentDiscoveryWithDiagnostics } from "@/lib/school-intelligence/talent-discovery";
import {
  recordSchoolIntelligenceGrowthTrendSummary,
  recordSchoolIntelligenceOpportunityDataQuality,
  recordSchoolIntelligenceTalentDiscovery,
} from "@/lib/school-intelligence/school-intelligence-section-tracer";
import { buildInterventions } from "@/lib/school-intelligence/intervention-engine";
import { buildOpportunityMapping } from "@/lib/school-intelligence/opportunity-mapping";
import { buildStrategicSchoolInsights } from "@/lib/school-intelligence/strategic-school-insights";
import { buildTrainingSchoolIntelligenceIndices } from "@/lib/partnerships/training-outcome-school-intelligence";
import type { SchoolIntelligencePayload } from "@/lib/school-intelligence/school-intelligence-types";

export const buildSchoolIntelligenceNetwork = async (): Promise<SchoolIntelligencePayload> => {
  const { nodes } = await buildStudentSuccessGraph();
  const longitudinalGrowth = await buildLongitudinalGrowth(nodes);
  const yearOverYearGrowthPct = computeYearOverYearGrowthPct(longitudinalGrowth);

  const departmentExcellence = buildDepartmentExcellenceIndex(nodes);
  const schoolExcellence = buildSchoolExcellenceIndex(nodes, departmentExcellence, yearOverYearGrowthPct);

  const avgSuccessIndex =
    nodes.length > 0 ? Math.round(nodes.reduce((s, n) => s + n.successIndex, 0) / nodes.length) : 0;

  const [opportunityResult, trainingOutcomeIndices] = await Promise.all([
    buildOpportunityMapping(nodes),
    buildTrainingSchoolIntelligenceIndices(),
  ]);
  recordSchoolIntelligenceOpportunityDataQuality(opportunityResult.dataQuality);

  const { rows: talentDiscovery, diagnostics: talentDiscoveryDiagnostics } =
    buildTalentDiscoveryWithDiagnostics(nodes);
  recordSchoolIntelligenceTalentDiscovery(talentDiscoveryDiagnostics);
  console.info("[SchoolIntelligence] talent discovery", talentDiscoveryDiagnostics);

  const interventions = buildInterventions(nodes);
  const strategicInsights = buildStrategicSchoolInsights({
    nodes,
    departmentExcellence,
    schoolExcellence,
    longitudinalGrowth,
    opportunityMapping: opportunityResult.rows,
    talentDiscovery,
  });

  const { trends: growthTrends, diagnostics: growthTrendSummary } = buildGrowthTrendsIntelligence({
    longitudinalGrowth,
    departmentExcellence,
    opportunityMapping: opportunityResult.rows,
    nodes,
  });
  recordSchoolIntelligenceGrowthTrendSummary(growthTrendSummary);

  return {
    generatedAt: new Date().toISOString(),
    studentSuccessGraph: {
      totalNodes: nodes.length,
      topStudents: nodes.slice(0, 25),
      avgSuccessIndex,
    },
    departmentExcellence,
    schoolExcellence,
    longitudinalGrowth,
    growthTrends,
    talentDiscovery,
    interventions,
    opportunityMapping: opportunityResult.rows,
    strategicInsights,
    trainingOutcomeIndices,
    governance: {
      readOnly: true,
      explainable: true,
      deterministic: true,
      dataSources: [
        "User (students)",
        "Achievement (approved, certificates read-only)",
        "StudentCareerProfile (read-only)",
        "TrainingCompletionRecord (read-only)",
        "TrainingOutcomeRecord (read-only)",
        "TrainingOpportunity",
        "PartnerOrganization",
        "buildStudentIntelligence",
        "buildInstitutionalSnapshot",
      ],
    },
  };
};
