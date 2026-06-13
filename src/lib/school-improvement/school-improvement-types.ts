export type ActionPriority = "high" | "medium" | "low";
export type ActionEffort = "low" | "medium" | "high";
export type ActionOwner =
  | "school_admin"
  | "department_head"
  | "counselor"
  | "partnerships"
  | "activities_coordinator"
  | "career_guidance";

export type TrackingStatus = "proposed" | "in_progress" | "completed" | "deferred";

export type ImprovementDomain =
  | "talent"
  | "competitions"
  | "training"
  | "volunteer"
  | "career_readiness"
  | "university_readiness";

export type ImprovementAction = {
  id: string;
  sourceInsightId: string;
  titleAr: string;
  titleEn: string;
  recommendationAr: string;
  recommendationEn: string;
  priority: ActionPriority;
  expectedImpactAr: string;
  expectedImpactEn: string;
  effort: ActionEffort;
  owner: ActionOwner;
  ownerLabelAr: string;
  ownerLabelEn: string;
  timeline: string;
  timelineEn: string;
  domain: ImprovementDomain | string;
  evidence: Array<{ label: string; value: string | number }>;
  trackingStatus: TrackingStatus;
};

export type ImprovementPlan = {
  id: string;
  domain: ImprovementDomain;
  titleAr: string;
  titleEn: string;
  objectiveAr: string;
  objectiveEn: string;
  actions: ImprovementAction[];
  priority: ActionPriority;
  evidence: string;
};

export type OpportunityRecommendation = {
  id: string;
  type: "partnership" | "competition" | "program";
  titleAr: string;
  titleEn: string;
  reasonAr: string;
  reasonEn: string;
  priority: ActionPriority;
  targetCohort: string;
  evidence: Array<{ label: string; value: string | number }>;
};

export type StudentActionList = {
  category: "intervention" | "training_opportunity" | "gifted_program";
  titleAr: string;
  titleEn: string;
  students: Array<{
    studentId: string;
    fullName: string;
    grade: string;
    reasonAr: string;
    reasonEn: string;
    suggestedActionAr: string;
    suggestedActionEn: string;
  }>;
};

export type DepartmentActionPlan = {
  key: string;
  dimension: "department" | "track" | "stage";
  labelAr: string;
  labelEn: string;
  currentIndex: number;
  targetIndex: number;
  actions: ImprovementAction[];
  timeline: string;
};

export type InstitutionExpansionSuggestion = {
  id: string;
  sector: "technology" | "university" | "incubator" | "health" | "engineering";
  titleAr: string;
  titleEn: string;
  reasonAr: string;
  reasonEn: string;
  studentSignal: string;
  priority: ActionPriority;
  evidence: Array<{ label: string; value: string | number }>;
};

export type PredictiveScenario = {
  id: string;
  scenarioAr: string;
  scenarioEn: string;
  changePct: number;
  metric: string;
  currentValue: number;
  projectedValue: number;
  projectedImpactAr: string;
  projectedImpactEn: string;
  confidence: "LOW" | "MEDIUM";
  method: string;
};

export type RoadmapItem = {
  id: string;
  period: string;
  periodLabelAr: string;
  periodLabelEn: string;
  horizon: "annual" | "quarterly" | "monthly";
  actions: Array<{ actionId: string; titleAr: string; titleEn: string; priority: ActionPriority }>;
};

export type ImprovementTrackingRow = {
  actionId: string;
  titleAr: string;
  titleEn: string;
  status: TrackingStatus;
  ownerLabelAr: string;
  priority: ActionPriority;
  timeline: string;
  lastUpdated: string;
};

export type SchoolImprovementPayload = {
  generatedAt: string;
  actionEngine: ImprovementAction[];
  improvementPlans: ImprovementPlan[];
  opportunityRecommendations: OpportunityRecommendation[];
  studentActionLists: StudentActionList[];
  departmentActionPlans: DepartmentActionPlan[];
  institutionExpansion: InstitutionExpansionSuggestion[];
  predictiveScenarios: PredictiveScenario[];
  strategicRoadmap: RoadmapItem[];
  improvementTracking: ImprovementTrackingRow[];
  summary: {
    totalActions: number;
    highPriority: number;
    proposedCount: number;
    schoolExcellenceIndex: number;
  };
  governance: {
    readOnly: true;
    explainable: true;
    deterministic: true;
    noAutoExecution: true;
    dataSources: string[];
  };
};

export type SchoolImprovementReportKind = "board" | "leadership" | "school_planning";
