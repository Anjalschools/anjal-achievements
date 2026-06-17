import type { StudentTrainingApplicationStatus } from "@/lib/partnerships/partnerships-constants";

/** Post-completion final evaluation workflow statuses (additive extension). */
export const FINAL_EVALUATION_APPLICATION_STATUSES = [
  "awaiting_final_evaluation_review",
  "final_evaluation_approved",
  "final_evaluation_rejected",
] as const;

export type FinalEvaluationApplicationStatus = (typeof FINAL_EVALUATION_APPLICATION_STATUSES)[number];

export const FINAL_EVALUATION_MODE_VALUES = ["portal", "uploaded_document"] as const;
export type FinalEvaluationMode = (typeof FINAL_EVALUATION_MODE_VALUES)[number];

export const FINAL_EVALUATION_AI_CLASSIFICATIONS = ["verified", "review_required", "suspicious"] as const;
export type FinalEvaluationAiClassification = (typeof FINAL_EVALUATION_AI_CLASSIFICATIONS)[number];

export const FINAL_EVALUATION_TIMELINE_ACTIONS = {
  studentSubmitted: "student_final_evaluation_submitted",
  institutionSubmitted: "institution_final_evaluation_submitted",
  institutionReportUploaded: "institution_final_report_uploaded",
  aiVerified: "final_report_ai_verified",
  reviewRequested: "final_evaluation_review_requested",
  approved: "final_evaluation_approved",
  rejected: "final_evaluation_rejected",
} as const;

export const FINAL_EVALUATION_AUDIT_ACTIONS = {
  created: "training_final_evaluation_created",
  updated: "training_final_evaluation_updated",
  approved: "training_final_evaluation_approved",
  rejected: "training_final_evaluation_rejected",
} as const;

export const FINAL_EVALUATION_CAREER_EVENT = "training_final_evaluation_approved" as const;

/** Additive transitions — does not modify APPLICATION_STATUS_TRANSITIONS. */
export const FINAL_EVALUATION_STATUS_TRANSITIONS: Record<string, StudentTrainingApplicationStatus[]> = {
  completed: ["awaiting_final_evaluation_review"],
  awaiting_final_evaluation_review: ["final_evaluation_approved", "final_evaluation_rejected"],
  final_evaluation_rejected: ["awaiting_final_evaluation_review"],
};

export const canFinalEvaluationTransition = (from: string, to: StudentTrainingApplicationStatus): boolean => {
  const allowed = FINAL_EVALUATION_STATUS_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
};

export const validateFinalEvaluationTransition = (
  from: string,
  to: StudentTrainingApplicationStatus
): { ok: true } | { ok: false; reason: string } => {
  if (!canFinalEvaluationTransition(from, to)) {
    return { ok: false, reason: `Invalid final evaluation transition: ${from} → ${to}` };
  }
  return { ok: true };
};

export const STUDENT_FINAL_EVALUATION_EDITABLE_STATUSES = new Set([
  "completed",
  "final_evaluation_rejected",
]);

export const isScore1to5 = (value: unknown): value is number => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 && n <= 5;
};

export const isScore1to10 = (value: unknown): value is number => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 && n <= 10;
};

export type FinalEvaluationAttachmentRef = {
  attachmentId?: string;
  fileName: string;
  storageKey: string;
  mimeType?: string;
  storageProvider?: "r2" | "cloudinary";
  label?: string;
  caption?: string;
};

export type FinalEvaluationAiVerification = {
  verificationScore: number;
  classification: FinalEvaluationAiClassification;
  positiveSignals: string[];
  negativeSignals: string[];
  summaryAr: string;
  summaryEn: string;
  verifiedAt: string;
  documentFingerprint: string;
  runStatus: "completed" | "failed" | "skipped";
  fieldChecks: {
    studentName: boolean;
    institutionName: boolean;
    trainingHours: boolean;
    trainingDates: boolean;
    supervisorName: boolean;
    supervisorSignature: boolean;
    institutionStamp: boolean;
  };
};
