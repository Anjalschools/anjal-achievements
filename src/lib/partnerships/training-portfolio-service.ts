import "server-only";
import connectDB from "@/lib/mongodb";
import TrainingOutcomeRecord from "@/models/TrainingOutcomeRecord";
import InstitutionTalentRecommendation from "@/models/InstitutionTalentRecommendation";
import TrainingCompletionRecord from "@/models/TrainingCompletionRecord";
import PartnerOrganization from "@/models/PartnerOrganization";
import TrainingOpportunity from "@/models/TrainingOpportunity";
import User from "@/models/User";
import {
  OUTCOME_LEVEL_LABELS,
  RECOGNITION_LABELS,
  type TrainingOutcomeLevel,
  type TrainingOutcomeRecognitionType,
} from "@/lib/partnerships/training-outcome-constants";
import { employabilityBandLabel } from "@/lib/partnerships/training-employability-scoring";

export type TrainingPortfolioPayload = {
  studentId: string;
  studentName: string;
  summary: {
    trainingCount: number;
    totalHours: number;
    avgEmployabilityScore: number;
    avgReadinessScore: number;
    employmentRecommendations: number;
    bestOutcomeLevel: TrainingOutcomeLevel | null;
  };
  timeline: Array<{
    applicationId: string;
    institutionName: string;
    opportunityTitle: string;
    academicYearLabel: string;
    trainingStartDate: string | null;
    trainingEndDate: string | null;
    trainingHours: number;
    employabilityScore: number;
    readinessScore: number;
    outcomeLevel: TrainingOutcomeLevel;
    approvedAt: string;
  }>;
  institutions: Array<{
    institutionId: string;
    institutionName: string;
    trainingCount: number;
    totalHours: number;
    avgEmployability: number;
  }>;
  employabilityTrend: Array<{ label: string; score: number }>;
  evaluationResults: Array<{
    applicationId: string;
    studentSatisfactionScore: number;
    institutionEvaluationScore: number;
    outcomeLevel: TrainingOutcomeLevel;
    recommendedForFutureTraining: boolean;
    recommendedForEmployment: boolean;
  }>;
  certificates: Array<{
    id: string;
    title: string;
    organizationName: string;
    hours: number;
    status: string;
    verificationPath: string | null;
  }>;
  recognitions: Array<{ type: TrainingOutcomeRecognitionType; labelAr: string; labelEn: string }>;
  reports: Array<{ applicationId: string; label: string; path: string }>;
};

const avg = (values: number[]) =>
  values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : 0;

const outcomeRank: Record<TrainingOutcomeLevel, number> = {
  excellent: 5,
  very_good: 4,
  good: 3,
  satisfactory: 2,
  needs_improvement: 1,
};

export const buildStudentTrainingPortfolio = async (
  studentId: string,
  locale: "ar" | "en" = "ar"
): Promise<TrainingPortfolioPayload | null> => {
  await connectDB();

  const user = await User.findById(studentId).select("fullName fullNameAr").lean();
  if (!user) return null;

  const outcomes = await TrainingOutcomeRecord.find({ studentId })
    .sort({ approvedAt: 1 })
    .lean();

  const [completions, recommendations] = await Promise.all([
    TrainingCompletionRecord.find({ studentId, status: "approved" }).sort({ submittedAt: -1 }).lean(),
    InstitutionTalentRecommendation.find({ studentId }).lean(),
  ]);

  const institutionIds = [...new Set(outcomes.map((o) => String(o.institutionId)))];
  const opportunityIds = [...new Set(outcomes.map((o) => String(o.opportunityId)))];

  const [institutions, opportunities] = await Promise.all([
    institutionIds.length
      ? PartnerOrganization.find({ _id: { $in: institutionIds } }).select("name").lean()
      : [],
    opportunityIds.length
      ? TrainingOpportunity.find({ _id: { $in: opportunityIds } }).select("title titleAr").lean()
      : [],
  ]);

  const institutionMap = new Map(institutions.map((i) => [String(i._id), String(i.name || "")]));
  const opportunityMap = new Map(
    opportunities.map((o) => [
      String(o._id),
      locale === "ar" ? String((o as { titleAr?: string }).titleAr || o.title || "") : String(o.title || ""),
    ])
  );

  const timeline = outcomes.map((o) => ({
    applicationId: String(o.applicationId),
    institutionName: institutionMap.get(String(o.institutionId)) || "",
    opportunityTitle: opportunityMap.get(String(o.opportunityId)) || "",
    academicYearLabel: o.academicYearLabel || "",
    trainingStartDate: o.trainingStartDate ? new Date(o.trainingStartDate).toISOString() : null,
    trainingEndDate: o.trainingEndDate ? new Date(o.trainingEndDate).toISOString() : null,
    trainingHours: o.trainingHours || 0,
    employabilityScore: o.employabilityScore,
    readinessScore: o.readinessScore,
    outcomeLevel: o.outcomeLevel as TrainingOutcomeLevel,
    approvedAt: new Date(o.approvedAt).toISOString(),
  }));

  const institutionBuckets = new Map<string, { hours: number; scores: number[]; count: number }>();
  for (const o of outcomes) {
    const key = String(o.institutionId);
    const bucket = institutionBuckets.get(key) || { hours: 0, scores: [], count: 0 };
    bucket.hours += o.trainingHours || 0;
    bucket.scores.push(o.employabilityScore);
    bucket.count += 1;
    institutionBuckets.set(key, bucket);
  }

  const institutionsList = [...institutionBuckets.entries()].map(([id, bucket]) => ({
    institutionId: id,
    institutionName: institutionMap.get(id) || id,
    trainingCount: bucket.count,
    totalHours: bucket.hours,
    avgEmployability: avg(bucket.scores),
  }));

  const employabilityTrend = outcomes.map((o, idx) => ({
    label: o.academicYearLabel || `#${idx + 1}`,
    score: o.employabilityScore,
  }));

  const evaluationResults = outcomes.map((o) => ({
    applicationId: String(o.applicationId),
    studentSatisfactionScore: o.studentSatisfactionScore,
    institutionEvaluationScore: o.institutionEvaluationScore,
    outcomeLevel: o.outcomeLevel as TrainingOutcomeLevel,
    recommendedForFutureTraining: o.recommendedForFutureTraining,
    recommendedForEmployment: o.recommendedForEmployment,
  }));

  const certificates = completions.map((c) => ({
    id: String(c._id),
    title: locale === "ar" ? "شهادة إكمال التدريب" : "Training completion certificate",
    organizationName: String(c.organizationName || ""),
    hours: Number(c.volunteerHours || 0),
    status: String(c.status || "approved"),
    verificationPath: c.achievementId ? `/achievements/${String(c.achievementId)}` : null,
  }));

  const recognitionSet = new Set<TrainingOutcomeRecognitionType>();
  for (const o of outcomes) {
    for (const r of o.recognitions || []) recognitionSet.add(r as TrainingOutcomeRecognitionType);
  }

  const recognitions = [...recognitionSet].map((type) => ({
    type,
    labelAr: RECOGNITION_LABELS[type].ar,
    labelEn: RECOGNITION_LABELS[type].en,
  }));

  const reports = outcomes.map((o) => ({
    applicationId: String(o.applicationId),
    label:
      locale === "ar"
        ? `تقرير نهائي — ${institutionMap.get(String(o.institutionId)) || ""}`
        : `Final report — ${institutionMap.get(String(o.institutionId)) || ""}`,
    path: `/summer-training/${o.applicationId}/final-report`,
  }));

  const totalHours = outcomes.reduce((s, o) => s + (o.trainingHours || 0), 0);
  const bestOutcome = outcomes.reduce<TrainingOutcomeLevel | null>((best, o) => {
    const level = o.outcomeLevel as TrainingOutcomeLevel;
    if (!best) return level;
    return outcomeRank[level] > outcomeRank[best] ? level : best;
  }, null);

  return {
    studentId,
    studentName: String(user.fullNameAr || user.fullName || ""),
    summary: {
      trainingCount: outcomes.length,
      totalHours,
      avgEmployabilityScore: avg(outcomes.map((o) => o.employabilityScore)),
      avgReadinessScore: avg(outcomes.map((o) => o.readinessScore)),
      employmentRecommendations: recommendations.length,
      bestOutcomeLevel: bestOutcome,
    },
    timeline,
    institutions: institutionsList,
    employabilityTrend,
    evaluationResults,
    certificates,
    recognitions,
    reports,
  };
};

export type GraduateReadinessWidgetPayload = {
  trainingCount: number;
  totalHours: number;
  employabilityScore: number;
  employabilityBandAr: string;
  employabilityBandEn: string;
  institutionRecommendations: number;
  employmentRecommendations: number;
  finalOutcomeLevel: TrainingOutcomeLevel | null;
  finalOutcomeLabelAr: string;
  finalOutcomeLabelEn: string;
  readinessScore: number;
};

export const buildGraduateReadinessWidget = async (
  studentId: string
): Promise<GraduateReadinessWidgetPayload> => {
  await connectDB();

  const [outcomes, recommendations] = await Promise.all([
    TrainingOutcomeRecord.find({ studentId }).sort({ approvedAt: -1 }).lean(),
    InstitutionTalentRecommendation.find({ studentId }).lean(),
  ]);

  const totalHours = outcomes.reduce((s, o) => s + (o.trainingHours || 0), 0);
  const avgEmployability = avg(outcomes.map((o) => o.employabilityScore));
  const avgReadiness = avg(outcomes.map((o) => o.readinessScore));
  const latest = outcomes[0];
  const band = employabilityBandLabel(avgEmployability, "ar");

  const finalLevel = (latest?.outcomeLevel as TrainingOutcomeLevel) || null;

  return {
    trainingCount: outcomes.length,
    totalHours,
    employabilityScore: avgEmployability,
    employabilityBandAr: band.label,
    employabilityBandEn: employabilityBandLabel(avgEmployability, "en").label,
    institutionRecommendations: outcomes.filter((o) => o.recommendedForFutureTraining).length,
    employmentRecommendations: recommendations.length,
    finalOutcomeLevel: finalLevel,
    finalOutcomeLabelAr: finalLevel ? OUTCOME_LEVEL_LABELS[finalLevel].ar : "—",
    finalOutcomeLabelEn: finalLevel ? OUTCOME_LEVEL_LABELS[finalLevel].en : "—",
    readinessScore: avgReadiness,
  };
};
