export type SchoolStage = "primary" | "middle" | "secondary" | "unknown";
export type SchoolTrack = "arabic" | "international" | "unknown";
export type SchoolDepartment = "mawhiba" | "general";

export type StudentSuccessSubScores = {
  achievementScore: number;
  trainingScore: number;
  volunteerScore: number;
  skillScore: number;
  careerReadiness: number;
  universityReadiness: number;
  consistencyScore: number;
};

export type StudentSuccessGraphNode = {
  studentId: string;
  fullNameAr: string;
  fullNameEn: string;
  avatarUrl: string;
  grade: string;
  stage: SchoolStage;
  track: SchoolTrack;
  department: SchoolDepartment;
  isMawhiba: boolean;
  recordCount: number;
  medalCount: number;
  medalRatioPct: number;
  distinctActivityCount: number;
  certificateCount: number;
  participationCount: number;
  trainingHours: number;
  volunteerHours: number;
  topSkills: string[];
  activityKeys: string[];
  growthIndex?: number;
  recentTrend: "accelerating" | "improving" | "stable" | "declining";
  momentum: "high" | "medium" | "low";
  subScores: StudentSuccessSubScores;
  successIndex: number;
  evidence: string;
};

export type DepartmentExcellenceRow = {
  key: string;
  dimension: "department" | "track" | "stage";
  labelAr: string;
  labelEn: string;
  studentCount: number;
  avgSuccessIndex: number;
  avgParticipation: number;
  growthRatePct: number;
  excellenceIndex: number;
  evidence: string;
};

export type SchoolExcellenceSummary = {
  excellenceIndex: number;
  avgStudentSuccessIndex: number;
  totalStudents: number;
  activeParticipants: number;
  participationRatePct: number;
  yearOverYearGrowthPct: number;
  evidence: string;
};

export type LongitudinalGrowthPoint = {
  year: number;
  participations: number;
  students: number;
  avgSuccessIndex: number;
  growthRatePct: number;
};

export type TalentDiscoveryRow = {
  studentId: string;
  fullName: string;
  talentType: "rapid_growth" | "underutilized" | "program_candidate";
  successIndex: number;
  detailAr: string;
  detailEn: string;
  evidence: Array<{ label: string; value: string | number }>;
};

export type InterventionRow = {
  studentId: string;
  fullName: string;
  interventionType: "activity_decline" | "participation_stop" | "readiness_drop";
  severity: "high" | "medium" | "low";
  detailAr: string;
  detailEn: string;
  evidence: Array<{ label: string; value: string | number }>;
};

export type OpportunityMappingRow = {
  key: string;
  dimension: "stage" | "track" | "department" | "activity" | "institution";
  labelAr: string;
  labelEn: string;
  opportunityCount: number;
  participantCount: number;
  gapPct: number;
  recommendationAr: string;
  recommendationEn: string;
};

export type StrategicSchoolInsight = {
  id: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  severity: "high" | "medium" | "low" | "info";
  insightType: string;
  evidence: Array<{ label: string; value: string | number }>;
};

export type SchoolIntelligencePayload = {
  generatedAt: string;
  studentSuccessGraph: {
    totalNodes: number;
    topStudents: StudentSuccessGraphNode[];
    avgSuccessIndex: number;
  };
  departmentExcellence: DepartmentExcellenceRow[];
  schoolExcellence: SchoolExcellenceSummary;
  longitudinalGrowth: LongitudinalGrowthPoint[];
  talentDiscovery: TalentDiscoveryRow[];
  interventions: InterventionRow[];
  opportunityMapping: OpportunityMappingRow[];
  strategicInsights: StrategicSchoolInsight[];
  governance: {
    readOnly: true;
    explainable: true;
    deterministic: true;
    dataSources: string[];
  };
};

export type SchoolIntelligenceReportKind = "school" | "board" | "strategic_planning";
