import type { StudentIntelligencePayload } from "@/lib/student-intelligence-analytics";
import type { SchoolIntelligencePayload } from "@/lib/school-intelligence/school-intelligence-types";

export type SchoolIntelligenceBuildStatus = "success" | "degraded" | "unavailable";

export type SchoolIntelligenceStepTiming = {
  step: string;
  durationMs: number;
  documentsReturned?: number;
  detail?: string;
};

export type SchoolIntelligenceDiagnostics = {
  generatedAt: string;
  status: SchoolIntelligenceBuildStatus;
  totalDurationMs: number;
  steps: SchoolIntelligenceStepTiming[];
  warnings: string[];
  snapshotFallback: boolean;
  messageAr?: string;
  messageEn?: string;
  timeoutSource?: string;
  runtimeVersion?: string;
  buildTimestamp?: string;
};

export type SchoolIntelligenceBuildResult = {
  intelligence: SchoolIntelligencePayload;
  diagnostics: SchoolIntelligenceDiagnostics;
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
    evidence: "",
  },
  longitudinalGrowth: [],
  talentDiscovery: [],
  interventions: [],
  opportunityMapping: [],
  strategicInsights: [],
  governance: {
    readOnly: true,
    explainable: true,
    deterministic: true,
    dataSources: [],
  },
});

export const createEmptyStudentIntelligencePayload = (): StudentIntelligencePayload => ({
  ok: true,
  generatedAt: new Date().toISOString(),
  filters: { status: "approved" },
  byWeightedScore: [],
  byParticipation: [],
  byMedals: [],
  bySuccessRate: [],
  byActivityDiversity: [],
  byFastestGrowth: [],
});
