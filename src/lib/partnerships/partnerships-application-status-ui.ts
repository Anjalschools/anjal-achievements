import type { StudentTrainingApplicationStatus } from "@/lib/partnerships/partnerships-constants";

const STATUS_LABEL_DEFAULT = { ar: "غير معروف", en: "Unknown" };

const LABELS: Record<StudentTrainingApplicationStatus, { ar: string; en: string }> = {
  submitted: { ar: "مقدّم", en: "Submitted" },
  under_review: { ar: "قيد المراجعة", en: "Under review" },
  interview_requested: { ar: "مقابلة مطلوبة", en: "Interview requested" },
  institution_review: { ar: "لدى المؤسسة", en: "With institution" },
  accepted: { ar: "معتمد", en: "Accepted" },
  awaiting_school_approval: { ar: "بانتظار اعتماد المدرسة", en: "Awaiting school approval" },
  rejected: { ar: "مرفوض", en: "Rejected" },
  withdrawn: { ar: "منسحب", en: "Withdrawn" },
  completed: { ar: "مكتمل", en: "Completed" },
};

/** Unified status badge colors — single source for all training UI. */
const BADGE_CLASS: Record<StudentTrainingApplicationStatus, string> = {
  submitted: "bg-blue-100 text-blue-900 ring-blue-200",
  under_review: "bg-yellow-100 text-yellow-950 ring-yellow-200",
  interview_requested: "bg-violet-100 text-violet-900 ring-violet-200",
  institution_review: "bg-orange-100 text-orange-950 ring-orange-200",
  accepted: "bg-green-100 text-green-900 ring-green-200",
  awaiting_school_approval: "bg-indigo-100 text-indigo-900 ring-indigo-200",
  rejected: "bg-red-100 text-red-900 ring-red-200",
  withdrawn: "bg-gray-100 text-gray-800 ring-gray-200",
  completed: "bg-green-800 text-green-50 ring-green-700",
};

const DOT_CLASS: Record<StudentTrainingApplicationStatus, string> = {
  submitted: "bg-blue-500",
  under_review: "bg-yellow-500",
  interview_requested: "bg-violet-500",
  institution_review: "bg-orange-500",
  accepted: "bg-green-500",
  awaiting_school_approval: "bg-indigo-500",
  rejected: "bg-red-500",
  withdrawn: "bg-gray-400",
  completed: "bg-green-800",
};

export const trainingApplicationStatusLabel = (status: string, isAr: boolean): string => {
  const row = LABELS[status as StudentTrainingApplicationStatus];
  if (!row) {
    return isAr ? STATUS_LABEL_DEFAULT.ar : STATUS_LABEL_DEFAULT.en;
  }
  return isAr ? row.ar : row.en;
};

export const trainingApplicationStatusBadgeClass = (status: string): string =>
  BADGE_CLASS[status as StudentTrainingApplicationStatus] || "bg-gray-100 text-gray-800 ring-gray-200";

export const trainingApplicationStatusDotClass = (status: string): string =>
  DOT_CLASS[status as StudentTrainingApplicationStatus] || "bg-gray-400";

/** Statuses that block a new application on the same opportunity. */
export const TRAINING_APPLICATION_BLOCKS_REAPPLY: StudentTrainingApplicationStatus[] = [
  "submitted",
  "under_review",
  "interview_requested",
  "institution_review",
  "accepted",
  "awaiting_school_approval",
  "completed",
];

export const trainingApplicationBlocksReapply = (status: string): boolean =>
  TRAINING_APPLICATION_BLOCKS_REAPPLY.includes(status as StudentTrainingApplicationStatus);
