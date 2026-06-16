export const TRAINING_OUTCOME_LEVELS = [
  "excellent",
  "very_good",
  "good",
  "satisfactory",
  "needs_improvement",
] as const;

export type TrainingOutcomeLevel = (typeof TRAINING_OUTCOME_LEVELS)[number];

export const TRAINING_OUTCOME_RECOGNITION_TYPES = [
  "outstanding_trainee",
  "high_potential_candidate",
  "excellent_professional_conduct",
  "top_training_performer",
] as const;

export type TrainingOutcomeRecognitionType = (typeof TRAINING_OUTCOME_RECOGNITION_TYPES)[number];

export const TRAINING_OUTCOME_TIMELINE_ACTIONS = {
  outcomeCreated: "training_outcome_created",
  employabilityGenerated: "employability_score_generated",
  readinessCalculated: "training_readiness_calculated",
  recommendationCreated: "institution_recommendation_created",
} as const;

export const TRAINING_OUTCOME_AUDIT_ACTIONS = {
  recordCreated: "training_outcome_record_created",
  employabilityGenerated: "training_employability_generated",
  recommendationGenerated: "training_recommendation_generated",
} as const;

export const TALENT_RECOMMENDATION_LEVELS = ["strong", "moderate", "conditional"] as const;
export type TalentRecommendationLevel = (typeof TALENT_RECOMMENDATION_LEVELS)[number];

export const OUTCOME_LEVEL_LABELS: Record<
  TrainingOutcomeLevel,
  { ar: string; en: string }
> = {
  excellent: { ar: "ممتاز", en: "Excellent" },
  very_good: { ar: "جيد جداً", en: "Very good" },
  good: { ar: "جيد", en: "Good" },
  satisfactory: { ar: "مقبول", en: "Satisfactory" },
  needs_improvement: { ar: "يحتاج تطوير", en: "Needs improvement" },
};

export const EMPLOYABILITY_BAND_LABELS = {
  excellent: { ar: "ممتاز", en: "Excellent", min: 90 },
  veryGood: { ar: "جيد جداً", en: "Very good", min: 80 },
  good: { ar: "جيد", en: "Good", min: 70 },
  acceptable: { ar: "مقبول", en: "Acceptable", min: 60 },
  needsDevelopment: { ar: "يحتاج تطوير", en: "Needs development", min: 0 },
} as const;

export const RECOGNITION_LABELS: Record<
  TrainingOutcomeRecognitionType,
  { ar: string; en: string }
> = {
  outstanding_trainee: { ar: "متدرب متميز", en: "Outstanding Trainee" },
  high_potential_candidate: { ar: "مرشح عالي الإمكانات", en: "High Potential Candidate" },
  excellent_professional_conduct: { ar: "سلوك مهني ممتاز", en: "Excellent Professional Conduct" },
  top_training_performer: { ar: "أفضل أداء تدريبي", en: "Top Training Performer" },
};
