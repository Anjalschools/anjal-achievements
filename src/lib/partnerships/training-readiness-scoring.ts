import type { TrainingOutcomeLevel } from "@/lib/partnerships/training-outcome-constants";

export type TrainingReadinessInput = {
  completedTrainingCount: number;
  totalTrainingHours: number;
  avgInstitutionEvaluationScore: number;
  avgStudentSatisfaction: number;
  institutionRecommendationRate: number;
  employmentRecommendationRate: number;
  passedTrainingRate: number;
};

const clamp = (n: number, min = 0, max = 100) => Math.min(max, Math.max(min, Math.round(n)));

/**
 * Training Program readiness metric — separate from Career Readiness.
 * Deterministic, rule-driven.
 */
export const computeTrainingReadinessScore = (input: TrainingReadinessInput): number => {
  const countFactor = clamp(input.completedTrainingCount * 12, 0, 24);
  const hoursFactor = clamp(input.totalTrainingHours * 0.15, 0, 20);
  const evalFactor = clamp(input.avgInstitutionEvaluationScore * 0.2, 0, 20);
  const satisfactionFactor = clamp(input.avgStudentSatisfaction * 2, 0, 15);
  const futureRecFactor = clamp(input.institutionRecommendationRate * 0.08, 0, 8);
  const employmentRecFactor = clamp(input.employmentRecommendationRate * 0.1, 0, 8);
  const passFactor = clamp(input.passedTrainingRate * 0.05, 0, 5);

  return clamp(
    countFactor + hoursFactor + evalFactor + satisfactionFactor + futureRecFactor + employmentRecFactor + passFactor
  );
};

/** Single-training readiness contribution for portfolio trend. */
export const computeSingleTrainingReadinessContribution = (input: {
  institutionEvaluationScore: number;
  studentSatisfactionScore: number;
  trainingHours: number;
  recommendedForFutureTraining: boolean;
  recommendedForEmployment: boolean;
  passedTraining: boolean;
}): number =>
  computeTrainingReadinessScore({
    completedTrainingCount: 1,
    totalTrainingHours: input.trainingHours,
    avgInstitutionEvaluationScore: input.institutionEvaluationScore,
    avgStudentSatisfaction: input.studentSatisfactionScore,
    institutionRecommendationRate: input.recommendedForFutureTraining ? 100 : 0,
    employmentRecommendationRate: input.recommendedForEmployment ? 100 : 0,
    passedTrainingRate: input.passedTraining ? 100 : 0,
  });

export const deriveOutcomeLevel = (input: {
  employabilityScore: number;
  readinessScore: number;
  passedTraining: boolean;
}): TrainingOutcomeLevel => {
  if (!input.passedTraining) return "needs_improvement";

  const composite = clamp(input.employabilityScore * 0.6 + input.readinessScore * 0.4);

  if (composite >= 90) return "excellent";
  if (composite >= 80) return "very_good";
  if (composite >= 70) return "good";
  if (composite >= 60) return "satisfactory";
  return "needs_improvement";
};
