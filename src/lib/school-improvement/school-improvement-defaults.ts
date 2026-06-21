import type { SchoolImprovementPayload } from "@/lib/school-improvement/school-improvement-types";
import type { SchoolIntelligencePayload } from "@/lib/school-intelligence/school-intelligence-types";
import type { StudentSuccessGraphNode } from "@/lib/school-intelligence/school-intelligence-types";

export const DEFAULT_PARTNERSHIP_INDICATORS: SchoolImprovementPayload["partnershipIndicators"] = {
  careerReadiness: 0,
  externalPartnerships: 0,
  professionalExposure: 0,
  studentPlacementSuccess: 0,
};

export const createEmptySchoolIntelligencePayload = (): SchoolIntelligencePayload => ({
  generatedAt: new Date().toISOString(),
  studentSuccessGraph: {
    totalNodes: 0,
    topStudents: [],
    avgSuccessIndex: 0,
  },
  departmentExcellence: [],
  schoolExcellence: {
    excellenceIndex: 0,
    avgStudentSuccessIndex: 0,
    totalStudents: 0,
    activeParticipants: 0,
    participationRatePct: 0,
    yearOverYearGrowthPct: 0,
    evidence: "unavailable",
  },
  longitudinalGrowth: [],
  talentDiscovery: [],
  interventions: [],
  opportunityMapping: [],
  strategicInsights: [],
  growthTrends: {
    highlights: [],
    participationTrajectory: "stable",
    forecastSignalAr: "",
    forecastSignalEn: "",
    summaryAr: "",
    summaryEn: "",
  },
  governance: {
    readOnly: true,
    explainable: true,
    deterministic: true,
    dataSources: [],
  },
});

export const createEmptyImprovementPayload = (): SchoolImprovementPayload => ({
  generatedAt: new Date().toISOString(),
  actionEngine: [],
  improvementPlans: [],
  opportunityRecommendations: [],
  studentActionLists: [],
  departmentActionPlans: [],
  institutionExpansion: [],
  predictiveScenarios: [],
  strategicRoadmap: [],
  improvementTracking: [],
  partnershipIndicators: DEFAULT_PARTNERSHIP_INDICATORS,
  summary: {
    totalActions: 0,
    highPriority: 0,
    proposedCount: 0,
    schoolExcellenceIndex: 0,
  },
  governance: {
    readOnly: true,
    explainable: true,
    deterministic: true,
    noAutoExecution: true,
    dataSources: [],
  },
});

export const EMPTY_STUDENT_NODES: StudentSuccessGraphNode[] = [];
