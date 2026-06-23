import type { PartnershipCategoryRankingGroupKey, TrainingOutcomeLevelKey } from "@/lib/partnerships/partnership-recommendation-constants";
import type { PartnershipEarlyRiskFlag } from "@/lib/partnerships/partnership-recommendation-constants";
import type { TrainingOpportunityMatchResult } from "@/lib/partnerships/training-opportunity-matching";

export type PartnerOrganizationRecommendationProfile = {
  organizationId: string;
  organizationName: string;
  category?: string;
  sector?: string;
  city?: string;
  partnerReliabilityIndex: number;
  organizationTrainingQualityIndex: number;
  combinedScore: number;
  applicantCount: number;
  averageStudentSatisfaction: number;
  recommendationRatePct: number;
  reportCompletionRatePct: number;
  averageResponseDays: number;
};

export type PartnershipCategoryRanking = {
  groupKey: PartnershipCategoryRankingGroupKey;
  labelAr: string;
  labelEn: string;
  partners: Array<{
    organizationId: string;
    organizationName: string;
    combinedScore: number;
    partnerReliabilityIndex: number;
    organizationTrainingQualityIndex: number;
  }>;
};

export type PartnershipExecutiveIntelligence = {
  generatedAt: string;
  bestPerformingPartners: PartnerOrganizationRecommendationProfile[];
  decliningPartners: PartnerOrganizationRecommendationProfile[];
  highDemandPartners: PartnerOrganizationRecommendationProfile[];
  lowSatisfactionPartners: PartnerOrganizationRecommendationProfile[];
  mostSuccessfulOpportunities: Array<{
    opportunityId: string;
    title: string;
    organizationName: string;
    successScore: number;
    trainingOutcomeLevel: TrainingOutcomeLevelKey;
  }>;
  categoryRankings: PartnershipCategoryRanking[];
};

export type StudentTrainingRecommendationPayload = {
  generatedAt: string;
  recommendations: Array<
    TrainingOpportunityMatchResult & {
      title: string;
      organizationCity?: string;
      organizationSector?: string;
    }
  >;
  earlyRisk?: {
    applicationId: string;
    opportunityTitle: string;
    riskFlags: PartnershipEarlyRiskFlag[];
    warningsAr: string[];
    warningsEn: string[];
  } | null;
};

export type AnnualPartnershipReport = {
  generatedAt: string;
  academicYearLabel: string;
  topOrganizations: Array<{ organizationName: string; combinedScore: number; recommendationRatePct: number }>;
  successTrends: Array<{ label: string; value: number }>;
  studentSatisfactionTrends: Array<{ label: string; average: number }>;
  completionTrends: Array<{ label: string; ratePct: number }>;
  recommendationTrends: Array<{ label: string; ratePct: number }>;
};
