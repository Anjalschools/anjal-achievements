import type {
  StudentTrainingApplicationStatus,
  SupervisorTrainingApplicationAction,
} from "@/lib/partnerships/partnerships-constants";
import type { TrainingCompletionStatus } from "@/lib/partnerships/training-completion-constants";

const TERMINAL_APPLICATION_STATUSES = new Set<StudentTrainingApplicationStatus>([
  "rejected",
  "withdrawn",
  "completed",
]);

/** Strict supervisor-driven transitions only. */
export const APPLICATION_STATUS_TRANSITIONS: Record<
  StudentTrainingApplicationStatus,
  StudentTrainingApplicationStatus[]
> = {
  submitted: ["under_review", "rejected", "withdrawn"],
  under_review: ["interview_requested", "institution_review", "rejected", "withdrawn"],
  interview_requested: ["institution_review", "rejected", "under_review", "withdrawn"],
  institution_review: ["accepted", "rejected", "interview_requested"],
  accepted: ["awaiting_school_approval"],
  awaiting_school_approval: [],
  rejected: ["under_review"],
  withdrawn: [],
  completed: [],
};

export const COMPLETION_STATUS_TRANSITIONS: Record<TrainingCompletionStatus, TrainingCompletionStatus[]> = {
  pending: ["submitted"],
  submitted: ["under_review", "rejected", "approved"],
  under_review: ["approved", "rejected", "pending"],
  approved: [],
  rejected: ["pending", "submitted"],
};

export const canTransitionApplicationStatus = (
  current: string,
  next: StudentTrainingApplicationStatus
): boolean => {
  const from = current as StudentTrainingApplicationStatus;
  if (!APPLICATION_STATUS_TRANSITIONS[from]) return false;
  if (from === next) return false;
  return APPLICATION_STATUS_TRANSITIONS[from].includes(next);
};

export const canSupervisorTransition = (
  current: string,
  action: SupervisorTrainingApplicationAction
): boolean => canTransitionApplicationStatus(current, action);

export const canAutomationCompleteApplication = (current: string): boolean =>
  current === "accepted" || current === "awaiting_school_approval";

export const canTransitionCompletionStatus = (
  current: string,
  next: TrainingCompletionStatus
): boolean => {
  const from = current as TrainingCompletionStatus;
  if (!COMPLETION_STATUS_TRANSITIONS[from]) return false;
  if (from === next) return false;
  return COMPLETION_STATUS_TRANSITIONS[from].includes(next);
};

export const validateApplicationTransition = (
  current: string,
  next: StudentTrainingApplicationStatus
): { ok: true } | { ok: false; reason: string } => {
  if (current === "rejected" && next === "under_review") {
    return { ok: true };
  }
  if (TERMINAL_APPLICATION_STATUSES.has(current as StudentTrainingApplicationStatus) && current !== "accepted") {
    return { ok: false, reason: `Cannot transition from terminal status: ${current}` };
  }
  if (next === "completed") {
    return { ok: false, reason: "completed can only be set via approved final report automation" };
  }
  if (next === "awaiting_school_approval" && current !== "accepted") {
    return { ok: false, reason: "awaiting_school_approval can only be set after accepted training" };
  }
  if (!canTransitionApplicationStatus(current, next)) {
    return { ok: false, reason: `Invalid transition: ${current} → ${next}` };
  }
  return { ok: true };
};

export const canReopenRejectedTrainingApplication = (current: string): boolean =>
  String(current || "").trim() === "rejected";

export const validateReopenRejectedTrainingApplication = (
  current: string,
  next: StudentTrainingApplicationStatus = "under_review"
): { ok: true } | { ok: false; reason: string } => {
  if (!canReopenRejectedTrainingApplication(current)) {
    return {
      ok: false,
      reason: `Application must be rejected to reopen (current: ${current || "unknown"})`,
    };
  }
  if (next !== "under_review") {
    return { ok: false, reason: "Reopen only supports transition to under_review" };
  }
  return validateApplicationTransition(current, next);
};
