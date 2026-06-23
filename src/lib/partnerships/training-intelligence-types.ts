import type { TrainingIntelligenceRiskFlag } from "@/lib/partnerships/training-intelligence-constants";
import type {
  TrainingNarrativeSimilarity,
  TrainingReportConsistencyResult,
} from "@/lib/partnerships/training-report-consistency";

export type TrainingReportIntelligence = TrainingReportConsistencyResult & {
  confidenceExplanation: {
    ocrConfidence?: number;
    visionConfidence?: number;
    overallConfidence?: number;
    stampDetectionConfidence?: number;
    signatureDetectionConfidence?: number;
  };
  organizationTrainingQualityIndex?: number;
  organizationQualityCategoryAr?: string;
  organizationQualityCategoryEn?: string;
};

export type OrganizationTrainingQualityProfile = {
  organizationId: string;
  organizationName: string;
  organizationTrainingQualityIndex: number;
  qualityCategoryAr: string;
  qualityCategoryEn: string;
  averageStudentSatisfaction: number;
  averageInstitutionEvaluation: number;
  recommendationRatePct: number;
  approvalRatePct: number;
  completionRatePct: number;
  reportCount: number;
};

export type TrainingExecutiveAnalytics = {
  generatedAt: string;
  topTrainingPartners: Array<{
    organizationId: string;
    organizationName: string;
    organizationTrainingQualityIndex: number;
    recommendationRatePct: number;
  }>;
  lowestRatedPartners: Array<{
    organizationId: string;
    organizationName: string;
    averageStudentSatisfaction: number;
    organizationTrainingQualityIndex: number;
  }>;
  highestRecommendationRate: Array<{
    organizationId: string;
    organizationName: string;
    recommendationRatePct: number;
  }>;
  institutionQualityRanking: Array<{
    organizationId: string;
    organizationName: string;
    organizationTrainingQualityIndex: number;
    qualityCategoryAr: string;
    qualityCategoryEn: string;
  }>;
};

export type { TrainingIntelligenceRiskFlag, TrainingNarrativeSimilarity };
