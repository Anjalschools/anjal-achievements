/**
 * Achievement Type Definitions
 */

export type AchievementType =
  | "competition"
  | "program"
  | "exhibition"
  | "olympiad"
  | "excellence_program"
  | "qudrat"
  | "mawhiba_annual"
  | "gifted_discovery"
  | "other";

export type AchievementLevel = "school" | "province" | "kingdom" | "international";

export type ParticipationType = "individual" | "team";

export type AchievementResultType =
  | "participation"
  | "medal"
  | "rank"
  | "nomination"
  | "special_award"
  | "recognition"
  | "other";

export type MedalType = "gold" | "silver" | "bronze";

export type RankType =
  | "first"
  | "second"
  | "third"
  | "fourth"
  | "fifth"
  | "sixth"
  | "seventh"
  | "eighth"
  | "ninth"
  | "tenth";

export interface AchievementFormData {
  // Basic Info
  studentId?: string;
  achievementType: AchievementType;
  achievementCategory?: "competition" | "program" | "exhibition";
  achievementName?: string;
  nameAr?: string;
  nameEn?: string;
  customAchievementName?: string;
  achievementLevel: AchievementLevel;
  participationType: ParticipationType;
  teamRole?: string;
  
  // Result
  resultType: AchievementResultType;
  resultValue?: string;
  medalType?: MedalType;
  rank?: RankType;
  nominationText?: string;
  specialAwardText?: string;
  recognitionText?: string;
  otherResultText?: string;
  
  // Type-specific fields
  programName?: string;
  customProgramName?: string;
  competitionName?: string;
  customCompetitionName?: string;
  exhibitionName?: string;
  customExhibitionName?: string;
  olympiadMeeting?: string;
  olympiadField?: string;
  excellenceProgramName?: string;
  customExcellenceProgramName?: string;
  qudratScore?: string;
  mawhibaAnnualRank?: RankType;
  mawhibaAnnualSubject?: string;
  giftedDiscoveryScore?: number;
  
  // Auto-calculated
  inferredField?: string;
  score?: number;
  scoreBreakdown?: Record<string, any>;
  
  // Additional
  achievementYear: number;
  description?: string;
  evidenceUrl?: string;
  evidenceFileName?: string;
  evidenceRequiredMode?: "provided" | "skipped";
  verificationStatus?: "unverified" | "pending_committee_review" | "verified" | "mismatch";
  verificationSummary?: string;
  evidenceExtractedData?: Record<string, unknown> | null;
  evidenceMatchStatus?: "unknown" | "matched" | "partial" | "mismatched";
  requiresCommitteeReview?: boolean;
  isProvisional?: boolean;
}

export interface AchievementFieldInference {
  field: string;
  normalizedCategory: string;
  sourceType: "competition" | "program" | "exhibition" | "olympiad" | "excellence_program" | "mawhiba" | "gifted_discovery" | "other";
}

export interface AchievementScoreResult {
  score: number;
  scoreBreakdown: {
    baseScore: number;
    levelMultiplier: number;
    resultMultiplier: number;
    typeBonus?: number;
    total: number;
    /** Set by scoring engine when level/result were normalized */
    normalizedLevel?: "school" | "province" | "national" | "international";
    effectiveResultType?: string;
  };
  isEligible: boolean;
  validationErrors: string[];
}
