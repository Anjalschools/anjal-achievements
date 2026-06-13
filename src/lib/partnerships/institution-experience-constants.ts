export const APPLICATION_REQUIREMENT_STATUSES = [
  "pending",
  "submitted",
  "overdue",
  "waived",
] as const;
export type ApplicationRequirementStatus = (typeof APPLICATION_REQUIREMENT_STATUSES)[number];

export const TRAINING_INTERVIEW_STATUSES = [
  "scheduled",
  "completed",
  "cancelled",
  "rescheduled",
] as const;
export type TrainingInterviewStatus = (typeof TRAINING_INTERVIEW_STATUSES)[number];

export const TRAINING_ASSESSMENT_TYPES = [
  "external_link",
  "upload_task",
  "questionnaire",
] as const;
export type TrainingAssessmentType = (typeof TRAINING_ASSESSMENT_TYPES)[number];

export const TRAINING_ASSESSMENT_STATUSES = [
  "pending",
  "submitted",
  "reviewed",
] as const;
export type TrainingAssessmentStatus = (typeof TRAINING_ASSESSMENT_STATUSES)[number];

export const INSTITUTION_FINAL_RECOMMENDATIONS = [
  "excellent",
  "very_good",
  "good",
  "acceptable",
  "not_recommended",
  "strongly_recommend",
  "recommend",
  "neutral",
  "not_recommend",
] as const;
export type InstitutionFinalRecommendation = (typeof INSTITUTION_FINAL_RECOMMENDATIONS)[number];

export const INSTITUTION_REVIEW_KINDS = ["decision", "completion_evaluation", "student_feedback"] as const;
export type InstitutionReviewKind = (typeof INSTITUTION_REVIEW_KINDS)[number];
