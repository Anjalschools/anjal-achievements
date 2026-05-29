/**
 * executive-insight-types.ts
 * Core types for the Executive AI Insights System.
 */

export type InsightType =
  | "growth"
  | "decline"
  | "risk"
  | "opportunity"
  | "talent_detection"
  | "program_gap"
  | "benchmark"
  | "anomaly"
  | "equity"
  | "track_rise"
  | "track_fall";

export type InsightSeverityLevel = "critical" | "high" | "medium" | "low" | "info";

export type InsightEvidence = {
  label: string;
  value: string | number;
  unit?: string;
};

export type ExecutiveInsight = {
  id: string;
  insightType: InsightType;
  severity: InsightSeverityLevel;
  title: string;
  titleEn: string;
  body: string;
  evidence: InsightEvidence[];
  recommendation: string;
  recommendationEn: string;
  affectedEntity: string;   // school name, stage name, student id, etc.
  affectedEntityType: "school" | "stage" | "student" | "activity" | "cohort";
  domain: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  generatedAt: string;
  metadata: Record<string, unknown>;
};

/** Input fed into insight engines */
export type InstitutionalSnapshot = {
  schoolBreakdown: SchoolMetrics[];
  stageBreakdown: StageMetrics[];
  activityBreakdown: ActivityMetrics[];
  yearOverYear: YearOverYearMetrics[];
  studentSamples?: StudentSample[];
};

export type SchoolMetrics = {
  schoolId: string;
  schoolName: string;
  totalStudents: number;
  totalParticipations: number;
  medalCount: number;
  awardCount: number;
  currentYear: number;
  previousYear: number;
  growthRatePct: number;
  activityCount: number;
};

export type StageMetrics = {
  stage: "primary" | "middle" | "secondary";
  section: "arabic" | "international" | "all";
  totalStudents: number;
  totalParticipations: number;
  participationRatePct: number;
  medalCount: number;
  awardCount: number;
};

export type ActivityMetrics = {
  activityKey: string;
  activityLabelAr: string;
  domain: string;
  participations: number;
  currentYear: number;
  previousYear: number;
  growthRatePct: number;
  awardCount: number;
};

export type YearOverYearMetrics = {
  year: number;
  totalParticipations: number;
  totalAwards: number;
  medalCount: number;
  activeSchools: number;
};

export type StudentSample = {
  userId: string;
  displayName: string;
  recentTrend: "accelerating" | "improving" | "stable" | "declining" | "volatile" | "emerging";
  momentum: "high" | "medium" | "low" | "none";
  peakQuality: number;
  recentQuality: number;
  olympiadTrajectory: "strong" | "building" | "weak" | "none";
};
