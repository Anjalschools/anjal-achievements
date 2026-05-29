import type { PathwayTag } from "@/lib/analytics/ai/opportunity-intelligence/competition-eligibility-config";

export type OpportunityDecisionKind =
  | "ELIGIBLE"
  | "RECOMMENDED"
  | "HIGH_POTENTIAL"
  | "FUTURE_OPPORTUNITY"
  | "BLOCKED"
  | "NOT_RECOMMENDED";

export type OpportunityPriority = "low" | "medium" | "high" | "critical";

export type StudentAcademicContext = {
  participantId: string;
  grade: string;
  /** 1–12 when known */
  gradeNumber: number | null;
  gradeInferred: boolean;
  stage: "primary" | "middle" | "secondary" | "unknown";
  section: "arabic" | "international" | "unknown";
  mawhiba: boolean;
  studyAbroadIntent: boolean;
  achievementHistory: StudentAchievementSignals;
};

export type StudentAchievementSignals = {
  activityKeys: string[];
  participationCount: number;
  medalCount: number;
  goldCount: number;
  silverCount: number;
  bronzeCount: number;
  nominationCount: number;
  distinctActivities: number;
  continuityYears: number;
  mathStrength: number;
  scienceStrength: number;
  languageStrength: number;
  qiyasScore: number | null;
  satScore: number | null;
  tags: PathwayTag[];
};

export type OpportunityDecisionFactor = {
  key: string;
  weight: number;
  labelAr: string;
  labelEn: string;
};

export type CompetitionOpportunityVerdict = {
  competitionKey: string;
  titleAr: string;
  titleEn: string;
  decision: OpportunityDecisionKind;
  confidence: number;
  priority: OpportunityPriority;
  readinessScore: number;
  matchScore: number;
  reasonsAr: string[];
  reasonsEn: string[];
  factors: OpportunityDecisionFactor[];
  timeHorizon: "now" | "next_year" | "long_term";
};

export type StudentOpportunityProfile = {
  participantId: string;
  generatedAt: string;
  eligibleCompetitions: CompetitionOpportunityVerdict[];
  recommendedCompetitions: CompetitionOpportunityVerdict[];
  blockedCompetitions: CompetitionOpportunityVerdict[];
  futureOpportunities: CompetitionOpportunityVerdict[];
  notRecommended: CompetitionOpportunityVerdict[];
  readinessScore: number;
  academicOpportunityScore: number;
  futurePotentialScore: number;
  olympiadPotentialScore: number;
  strengths: string[];
  weaknesses: string[];
  pathwayRecommendations: PathwayRecommendation[];
};

export type PathwayRecommendation = {
  id: string;
  titleAr: string;
  titleEn: string;
  competitionKeys: string[];
  avoidKeys: string[];
  rationaleAr: string;
  rationaleEn: string;
  priority: OpportunityPriority;
};
