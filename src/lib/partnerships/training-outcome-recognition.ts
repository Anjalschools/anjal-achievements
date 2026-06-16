import type { TrainingOutcomeLevel, TrainingOutcomeRecognitionType } from "@/lib/partnerships/training-outcome-constants";

export type RecognitionRuleInput = {
  employabilityScore: number;
  institutionEvaluationScore: number;
  professionalismScore: number;
  safetyComplianceScore: number;
  passedTraining: boolean;
  recommendedForEmployment: boolean;
  outcomeLevel: TrainingOutcomeLevel;
};

/**
 * Rule-based recognitions — informational only, no Achievement records.
 */
export const deriveTrainingRecognitions = (input: RecognitionRuleInput): TrainingOutcomeRecognitionType[] => {
  const recognitions: TrainingOutcomeRecognitionType[] = [];

  if (input.passedTraining && input.employabilityScore >= 90) {
    recognitions.push("outstanding_trainee");
  }

  if (input.recommendedForEmployment && input.employabilityScore >= 80) {
    recognitions.push("high_potential_candidate");
  }

  if (input.professionalismScore >= 4 && input.safetyComplianceScore >= 4) {
    recognitions.push("excellent_professional_conduct");
  }

  if (input.outcomeLevel === "excellent") {
    recognitions.push("top_training_performer");
  }

  return [...new Set(recognitions)];
};
