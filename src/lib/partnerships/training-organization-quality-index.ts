import { trainingQualityLabelForScore } from "@/lib/partnerships/training-intelligence-constants";

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(value)));
const round1 = (value: number) => Math.round(value * 10) / 10;
const pct = (num: number, den: number) => (den > 0 ? clamp((num / den) * 100) : 0);
const avg = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

export type OrganizationQualityRecordInput = {
  status?: string;
  studentBenefitRating?: number;
  practicalBenefitRating?: number;
  supervisorCooperationRating?: number;
  workEnvironmentRating?: number;
  recommendInstitutionToPeers?: boolean;
  overallRecommendation?: number;
  attendanceCommitment?: number;
  professionalEthics?: number;
  safetyCompliance?: number;
  institutionUploadedEvaluation?: Record<string, unknown>;
};

const institutionEvaluationScore = (record: OrganizationQualityRecordInput) => {
  const uploaded = record.institutionUploadedEvaluation || {};
  const values = [
    record.attendanceCommitment,
    record.professionalEthics,
    record.safetyCompliance,
    record.overallRecommendation,
    uploaded.disciplineRating,
    uploaded.communicationRating,
    uploaded.teamworkRating,
    uploaded.initiativeRating,
    uploaded.technicalSkillsRating,
    uploaded.problemSolvingRating,
    uploaded.taskExecutionRating,
    uploaded.safetyRating,
  ].filter((value): value is number => typeof value === "number" && value >= 1 && value <= 5);
  return values.length ? avg(values) : 0;
};

const studentSatisfactionScore = (record: OrganizationQualityRecordInput) => {
  const values = [
    record.studentBenefitRating,
    record.practicalBenefitRating,
    record.supervisorCooperationRating,
    record.workEnvironmentRating,
  ].filter((value): value is number => typeof value === "number" && value >= 1 && value <= 5);
  return values.length ? avg(values) : 0;
};

export const computeOrganizationTrainingQualityIndex = (records: OrganizationQualityRecordInput[]) => {
  if (!records.length) {
    return {
      organizationTrainingQualityIndex: 0,
      averageStudentSatisfaction: 0,
      averageInstitutionEvaluation: 0,
      recommendationRatePct: 0,
      approvalRatePct: 0,
      completionRatePct: 0,
      reportCount: 0,
      qualityCategoryAr: trainingQualityLabelForScore(0, true),
      qualityCategoryEn: trainingQualityLabelForScore(0, false),
    };
  }

  const institutionScores = records.map(institutionEvaluationScore).filter((value) => value > 0);
  const studentScores = records.map(studentSatisfactionScore).filter((value) => value > 0);
  const recommendationCount = records.filter((row) => row.recommendInstitutionToPeers === true).length;
  const approvedCount = records.filter((row) => String(row.status) === "approved").length;
  const completedCount = records.filter((row) =>
    ["approved", "submitted", "under_review"].includes(String(row.status))
  ).length;

  const averageInstitutionEvaluation = institutionScores.length ? round1(avg(institutionScores)) : 0;
  const averageStudentSatisfaction = studentScores.length ? round1(avg(studentScores)) : 0;
  const recommendationRatePct = pct(recommendationCount, records.length);
  const approvalRatePct = pct(approvedCount, records.length);
  const completionRatePct = pct(completedCount, records.length);

  const organizationTrainingQualityIndex = clamp(
    averageInstitutionEvaluation * 20 * 0.25 +
      averageStudentSatisfaction * 20 * 0.25 +
      recommendationRatePct * 0.2 +
      approvalRatePct * 0.15 +
      completionRatePct * 0.15
  );

  return {
    organizationTrainingQualityIndex,
    averageStudentSatisfaction,
    averageInstitutionEvaluation,
    recommendationRatePct,
    approvalRatePct,
    completionRatePct,
    reportCount: records.length,
    qualityCategoryAr: trainingQualityLabelForScore(organizationTrainingQualityIndex, true),
    qualityCategoryEn: trainingQualityLabelForScore(organizationTrainingQualityIndex, false),
  };
};
