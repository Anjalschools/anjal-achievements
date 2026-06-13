export const TRAINING_EXCELLENCE_WEIGHT_DEFAULT = 5;
export const TRAINING_EXCELLENCE_WEIGHT_HIGH = 10;

export const isHighTrainingExcellenceRating = (input: {
  studentBenefitRating?: number | null;
  overallRecommendation?: number | null;
}): boolean => {
  const benefit = Number(input.studentBenefitRating ?? 0);
  const overall = Number(input.overallRecommendation ?? 0);
  return benefit >= 4 && overall >= 4;
};

export const resolveTrainingExcellenceWeight = (input: {
  studentBenefitRating?: number | null;
  overallRecommendation?: number | null;
}): number =>
  isHighTrainingExcellenceRating(input)
    ? TRAINING_EXCELLENCE_WEIGHT_HIGH
    : TRAINING_EXCELLENCE_WEIGHT_DEFAULT;
