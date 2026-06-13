export const PARTNERSHIP_TARGET_GENDERS = ["male", "female", "both"] as const;
export type PartnershipTargetGender = (typeof PARTNERSHIP_TARGET_GENDERS)[number];

export const PARTNERSHIP_TARGET_STAGES = ["elementary", "middle", "high"] as const;
export type PartnershipTargetStage = (typeof PARTNERSHIP_TARGET_STAGES)[number];

export const STUDENT_TRAINING_APPLICATION_STATUSES = [
  "submitted",
  "under_review",
  "interview_requested",
  "institution_review",
  "accepted",
  "awaiting_school_approval",
  "rejected",
  "withdrawn",
  "completed",
] as const;
export type StudentTrainingApplicationStatus = (typeof STUDENT_TRAINING_APPLICATION_STATUSES)[number];

/** Blocks a new application while any of these statuses exists for the student. */
export const ACTIVE_TRAINING_APPLICATION_STATUSES = [
  "submitted",
  "under_review",
  "interview_requested",
  "institution_review",
  "accepted",
  "awaiting_school_approval",
] as const;
export type ActiveTrainingApplicationStatus = (typeof ACTIVE_TRAINING_APPLICATION_STATUSES)[number];

export const SUPERVISOR_TRAINING_APPLICATION_ACTIONS = [
  "under_review",
  "interview_requested",
  "institution_review",
  "accepted",
  "rejected",
] as const;
export type SupervisorTrainingApplicationAction = (typeof SUPERVISOR_TRAINING_APPLICATION_ACTIONS)[number];

export const PARTNERSHIP_TARGET_GRADE_VALUES = [
  "g1",
  "g2",
  "g3",
  "g4",
  "g5",
  "g6",
  "g7",
  "g8",
  "g9",
  "g10",
  "g11",
  "g12",
] as const;

export type PartnershipRegistrationStatus = "open" | "not_started" | "closed" | "unknown";
