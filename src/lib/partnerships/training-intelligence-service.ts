import "server-only";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import PartnerOrganization from "@/models/PartnerOrganization";
import TrainingCompletionRecord from "@/models/TrainingCompletionRecord";
import {
  trainingQualityLabelForScore,
} from "@/lib/partnerships/training-intelligence-constants";
import type {
  OrganizationTrainingQualityProfile,
  TrainingExecutiveAnalytics,
  TrainingReportIntelligence,
} from "@/lib/partnerships/training-intelligence-types";
export type {
  OrganizationTrainingQualityProfile,
  TrainingExecutiveAnalytics,
  TrainingIntelligenceRiskFlag,
  TrainingReportIntelligence,
} from "@/lib/partnerships/training-intelligence-types";
import {
  analyzeTrainingReportConsistency,
  type TrainingReportConsistencyInput,
} from "@/lib/partnerships/training-report-consistency";

import {
  computeOrganizationTrainingQualityIndex,
} from "@/lib/partnerships/training-organization-quality-index";

export const buildTrainingReportIntelligence = (
  record: TrainingReportConsistencyInput & {
    institutionReportExtraction?: Record<string, unknown> | null;
    organizationTrainingQualityIndex?: number;
  }
): TrainingReportIntelligence => {
  const consistency = analyzeTrainingReportConsistency(record);
  const validationResult =
    record.institutionReportExtraction?.validationResult &&
    typeof record.institutionReportExtraction.validationResult === "object"
      ? (record.institutionReportExtraction.validationResult as Record<string, unknown>)
      : null;

  const qualityIndex = record.organizationTrainingQualityIndex;
  return {
    ...consistency,
    confidenceExplanation: {
      ocrConfidence:
        typeof validationResult?.ocrConfidence === "number" ? validationResult.ocrConfidence : undefined,
      visionConfidence:
        typeof validationResult?.visionConfidence === "number" ? validationResult.visionConfidence : undefined,
      overallConfidence:
        typeof validationResult?.overallConfidence === "number"
          ? validationResult.overallConfidence
          : typeof validationResult?.confidence === "number"
            ? validationResult.confidence
            : undefined,
      stampDetectionConfidence:
        typeof validationResult?.stampConfidence === "number" ? validationResult.stampConfidence : undefined,
      signatureDetectionConfidence:
        typeof validationResult?.signatureConfidence === "number"
          ? validationResult.signatureConfidence
          : undefined,
    },
    organizationTrainingQualityIndex: qualityIndex,
    organizationQualityCategoryAr:
      typeof qualityIndex === "number" ? trainingQualityLabelForScore(qualityIndex, true) : undefined,
    organizationQualityCategoryEn:
      typeof qualityIndex === "number" ? trainingQualityLabelForScore(qualityIndex, false) : undefined,
  };
};

export const computeOrganizationTrainingQualityIndexFromRecords = computeOrganizationTrainingQualityIndex;

export const buildOrganizationTrainingQualityProfile = async (
  organizationId: string
): Promise<OrganizationTrainingQualityProfile | null> => {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(organizationId)) return null;

  const [organization, records] = await Promise.all([
    PartnerOrganization.findById(organizationId).select("name").lean(),
    TrainingCompletionRecord.find({ organizationId }).lean(),
  ]);
  if (!organization) return null;

  const metrics = computeOrganizationTrainingQualityIndex(records);
  return {
    organizationId,
    organizationName: organization.name || "",
    organizationTrainingQualityIndex: metrics.organizationTrainingQualityIndex,
    qualityCategoryAr: metrics.qualityCategoryAr,
    qualityCategoryEn: metrics.qualityCategoryEn,
    averageStudentSatisfaction: metrics.averageStudentSatisfaction,
    averageInstitutionEvaluation: metrics.averageInstitutionEvaluation,
    recommendationRatePct: metrics.recommendationRatePct,
    approvalRatePct: metrics.approvalRatePct,
    completionRatePct: metrics.completionRatePct,
    reportCount: metrics.reportCount,
  };
};

export const buildTrainingExecutiveAnalytics = async (): Promise<TrainingExecutiveAnalytics> => {
  await connectDB();
  const records = await TrainingCompletionRecord.find({}).lean();
  const orgIds = [...new Set(records.map((row) => String(row.organizationId)).filter(Boolean))];
  const orgs = await PartnerOrganization.find({ _id: { $in: orgIds } }).select("name").lean();
  const orgNameMap = new Map(orgs.map((org) => [String(org._id), org.name || ""]));

  const profiles = orgIds.map((organizationId) => {
    const orgRecords = records.filter((row) => String(row.organizationId) === organizationId);
    const metrics = computeOrganizationTrainingQualityIndex(orgRecords);
    return {
      organizationId,
      organizationName: orgNameMap.get(organizationId) || organizationId,
      ...metrics,
      qualityCategoryAr: trainingQualityLabelForScore(metrics.organizationTrainingQualityIndex, true),
      qualityCategoryEn: trainingQualityLabelForScore(metrics.organizationTrainingQualityIndex, false),
    };
  });

  const ranked = [...profiles].sort(
    (a, b) => b.organizationTrainingQualityIndex - a.organizationTrainingQualityIndex
  );

  return {
    generatedAt: new Date().toISOString(),
    topTrainingPartners: ranked.slice(0, 5).map((row) => ({
      organizationId: row.organizationId,
      organizationName: row.organizationName,
      organizationTrainingQualityIndex: row.organizationTrainingQualityIndex,
      recommendationRatePct: row.recommendationRatePct,
    })),
    lowestRatedPartners: [...profiles]
      .sort((a, b) => a.averageStudentSatisfaction - b.averageStudentSatisfaction)
      .slice(0, 5)
      .map((row) => ({
        organizationId: row.organizationId,
        organizationName: row.organizationName,
        averageStudentSatisfaction: row.averageStudentSatisfaction,
        organizationTrainingQualityIndex: row.organizationTrainingQualityIndex,
      })),
    highestRecommendationRate: [...profiles]
      .sort((a, b) => b.recommendationRatePct - a.recommendationRatePct)
      .slice(0, 5)
      .map((row) => ({
        organizationId: row.organizationId,
        organizationName: row.organizationName,
        recommendationRatePct: row.recommendationRatePct,
      })),
    institutionQualityRanking: ranked.map((row) => ({
      organizationId: row.organizationId,
      organizationName: row.organizationName,
      organizationTrainingQualityIndex: row.organizationTrainingQualityIndex,
      qualityCategoryAr: row.qualityCategoryAr,
      qualityCategoryEn: row.qualityCategoryEn,
    })),
  };
};

export const buildTrainingReportIntelligenceForRecord = async (record: TrainingReportConsistencyInput & {
  organizationId?: string;
  institutionReportExtraction?: Record<string, unknown> | null;
}) => {
  let organizationTrainingQualityIndex: number | undefined;
  if (record.organizationId) {
    const profile = await buildOrganizationTrainingQualityProfile(record.organizationId);
    organizationTrainingQualityIndex = profile?.organizationTrainingQualityIndex;
  }
  return buildTrainingReportIntelligence({
    ...record,
    organizationTrainingQualityIndex,
  });
};
