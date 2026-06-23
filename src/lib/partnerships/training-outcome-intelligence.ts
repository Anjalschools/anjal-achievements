import {
  trainingOutcomeLevelForScore,
  type TrainingOutcomeLevelKey,
} from "@/lib/partnerships/partnership-recommendation-constants";

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export type TrainingOutcomeInput = {
  studentSatisfaction?: number;
  institutionEvaluation?: number;
  consistencyScore?: number;
  recommendationRatePct?: number;
};

export type TrainingOutcomeIntelligence = {
  trainingOutcomeLevel: TrainingOutcomeLevelKey;
  outcomeScore: number;
  studentSatisfactionScore: number;
  institutionEvaluationScore: number;
  consistencyScore: number;
  recommendationRatePct: number;
};

export const computeTrainingOutcomeIntelligence = (
  input: TrainingOutcomeInput
): TrainingOutcomeIntelligence => {
  const studentSatisfactionScore = clamp((input.studentSatisfaction ?? 0) * 20);
  const institutionEvaluationScore = clamp((input.institutionEvaluation ?? 0) * 20);
  const consistencyScore = clamp(input.consistencyScore ?? 0);
  const recommendationRatePct = clamp(input.recommendationRatePct ?? 0);

  const outcomeScore = clamp(
    studentSatisfactionScore * 0.3 +
      institutionEvaluationScore * 0.3 +
      consistencyScore * 0.25 +
      recommendationRatePct * 0.15
  );

  return {
    trainingOutcomeLevel: trainingOutcomeLevelForScore(outcomeScore),
    outcomeScore,
    studentSatisfactionScore,
    institutionEvaluationScore,
    consistencyScore,
    recommendationRatePct,
  };
};
