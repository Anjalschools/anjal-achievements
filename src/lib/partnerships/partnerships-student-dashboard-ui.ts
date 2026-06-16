import type { StudentTrainingApplicationStatus } from "@/lib/partnerships/partnerships-constants";
import { STUDENT_TRAINING_APPLICATION_STATUSES } from "@/lib/partnerships/partnerships-constants";
import { trainingApplicationStatusBadgeClass } from "@/lib/partnerships/partnerships-application-status-ui";

export type StudentTrainingWidgetStatus =
  | "not_applied"
  | "submitted"
  | "under_review"
  | "interview_requested"
  | "institution_review"
  | "accepted"
  | "awaiting_school_approval"
  | "rejected"
  | "withdrawn"
  | "completed"
  | "awaiting_final_evaluation_review"
  | "final_evaluation_approved"
  | "final_evaluation_rejected"
  | "administratively_cancelled"
  | "unknown";

export const STUDENT_TRAINING_WIDGET_LABEL_DEFAULT = { ar: "غير معروف", en: "Unknown" };

export const STUDENT_TRAINING_WIDGET_LABELS: Record<
  StudentTrainingWidgetStatus,
  { ar: string; en: string }
> = {
  not_applied: { ar: "لم يتم التقديم", en: "Not applied" },
  submitted: { ar: "تم التقديم", en: "Submitted" },
  under_review: { ar: "قيد المراجعة", en: "Under review" },
  interview_requested: { ar: "مقابلة مطلوبة", en: "Interview requested" },
  institution_review: { ar: "لدى المؤسسة", en: "With institution" },
  accepted: { ar: "تم القبول", en: "Accepted" },
  awaiting_school_approval: { ar: "بانتظار اعتماد المدرسة", en: "Awaiting school approval" },
  rejected: { ar: "مرفوض", en: "Rejected" },
  withdrawn: { ar: "منسحب", en: "Withdrawn" },
  completed: { ar: "تم إكمال التدريب", en: "Training completed" },
  awaiting_final_evaluation_review: { ar: "بانتظار مراجعة التقييم النهائي", en: "Awaiting final evaluation review" },
  final_evaluation_approved: { ar: "التقييم النهائي معتمد", en: "Final evaluation approved" },
  final_evaluation_rejected: { ar: "التقييم النهائي مرفوض", en: "Final evaluation rejected" },
  administratively_cancelled: { ar: "تم إلغاء الطلب من قبل الإدارة", en: "Administratively cancelled" },
  unknown: STUDENT_TRAINING_WIDGET_LABEL_DEFAULT,
};

/** Legacy / alias statuses that may appear in stored data or institution fields. */
const WIDGET_STATUS_ALIASES: Record<string, StudentTrainingWidgetStatus> = {
  institution_accepted: "accepted",
  institution_rejected: "rejected",
  institution_pending: "institution_review",
  institution_interview: "interview_requested",
  institution_training_evaluated: "completed",
  approved: "accepted",
  training_in_progress: "accepted",
  training_completed: "completed",
};

const KNOWN_WIDGET_STATUSES = new Set<string>([
  "not_applied",
  ...STUDENT_TRAINING_APPLICATION_STATUSES,
  "unknown",
]);

export const resolveStudentTrainingWidgetStatus = (
  status: string | null | undefined
): StudentTrainingWidgetStatus => {
  if (!status) return "not_applied";
  const normalized = String(status).trim();
  if (!normalized) return "not_applied";
  if (WIDGET_STATUS_ALIASES[normalized]) return WIDGET_STATUS_ALIASES[normalized];
  if (KNOWN_WIDGET_STATUSES.has(normalized)) {
    return normalized as StudentTrainingWidgetStatus;
  }
  return "unknown";
};

export const resolveStudentTrainingWidgetLabels = (
  status: StudentTrainingWidgetStatus | string | null | undefined
): { ar: string; en: string } => {
  const widgetStatus = resolveStudentTrainingWidgetStatus(
    typeof status === "string" || status == null ? status : status
  );
  return (
    STUDENT_TRAINING_WIDGET_LABELS[widgetStatus] ?? STUDENT_TRAINING_WIDGET_LABEL_DEFAULT
  );
};

export const studentTrainingWidgetStatusLabel = (
  status: StudentTrainingWidgetStatus | string | null | undefined,
  isAr: boolean
): string => {
  const labels = resolveStudentTrainingWidgetLabels(status);
  return isAr ? labels.ar : labels.en;
};

/** Resolve display label directly from application status with full fallback chain. */
export const studentTrainingApplicationDisplayLabel = (
  status: string | null | undefined,
  isAr: boolean
): string => {
  const labels = resolveStudentTrainingWidgetLabels(status);
  return isAr ? labels.ar : labels.en;
};

export const STUDENT_TRAINING_WIDGET_BADGE: Record<StudentTrainingWidgetStatus, string> = {
  not_applied: "bg-gray-100 text-gray-800 ring-gray-200",
  submitted: trainingApplicationStatusBadgeClass("submitted"),
  under_review: trainingApplicationStatusBadgeClass("under_review"),
  interview_requested: trainingApplicationStatusBadgeClass("interview_requested"),
  institution_review: trainingApplicationStatusBadgeClass("institution_review"),
  accepted: trainingApplicationStatusBadgeClass("accepted"),
  awaiting_school_approval: trainingApplicationStatusBadgeClass("awaiting_school_approval"),
  rejected: trainingApplicationStatusBadgeClass("rejected"),
  withdrawn: trainingApplicationStatusBadgeClass("withdrawn"),
  completed: trainingApplicationStatusBadgeClass("completed"),
  awaiting_final_evaluation_review: trainingApplicationStatusBadgeClass("awaiting_final_evaluation_review"),
  final_evaluation_approved: trainingApplicationStatusBadgeClass("final_evaluation_approved"),
  final_evaluation_rejected: trainingApplicationStatusBadgeClass("final_evaluation_rejected"),
  administratively_cancelled: trainingApplicationStatusBadgeClass("administratively_cancelled"),
  unknown: "bg-gray-100 text-gray-800 ring-gray-200",
};

export const studentTrainingWidgetBadgeClass = (
  status: StudentTrainingWidgetStatus | string | null | undefined
): string => {
  const widgetStatus = resolveStudentTrainingWidgetStatus(
    typeof status === "string" || status == null ? status : status
  );
  return STUDENT_TRAINING_WIDGET_BADGE[widgetStatus] ?? STUDENT_TRAINING_WIDGET_BADGE.unknown;
};
