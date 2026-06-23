import type { AchievementTrainingCorrelation } from "@/lib/talent-pathway/achievement-training-correlation";
import type { StudentTalentProfile } from "@/lib/talent-pathway/student-talent-profile";
import type { TalentCareerReadinessIndex } from "@/lib/talent-pathway/talent-career-readiness-index";
import type { TalentFutureRecommendation } from "@/lib/talent-pathway/talent-future-recommendations";
import type { LongitudinalGrowthSeries } from "@/lib/talent-pathway/talent-longitudinal-growth";
import type { TalentDiscoveryCandidate } from "@/lib/talent-pathway/talent-discovery-alerts";

export type StudentTalentPathwayPayload = {
  generatedAt: string;
  studentTalentProfile: StudentTalentProfile;
  careerReadinessIndex: TalentCareerReadinessIndex;
  achievementTrainingCorrelation: AchievementTrainingCorrelation;
  futureRecommendations: TalentFutureRecommendation[];
  longitudinalGrowth: LongitudinalGrowthSeries;
};

export type AlumniTalentPreparationPayload = {
  generatedAt: string;
  recommendedMentors: Array<{ focusAreaAr: string; focusAreaEn: string; reasonAr: string; reasonEn: string }>;
  careerPathways: Array<{ titleAr: string; titleEn: string; reasonAr: string; reasonEn: string }>;
  universityPreparation: Array<{ titleAr: string; titleEn: string; reasonAr: string; reasonEn: string }>;
  communityReadinessScore: number;
};

export type ExecutiveTalentIntelligence = {
  generatedAt: string;
  bestPathways: Array<{ pathway: string; correlationScore: number }>;
  mostImpactfulPrograms: Array<{ programLabelAr: string; programLabelEn: string; impactScore: number }>;
  topTalentDevelopingPartners: Array<{ organizationName: string; developmentScore: number }>;
  emergingFields: Array<{ fieldAr: string; fieldEn: string; growthScore: number }>;
  highPotentialStudents: TalentDiscoveryCandidate[];
};
