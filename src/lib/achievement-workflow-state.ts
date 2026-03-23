/**
 * Optional workflowState layer on achievements (revision / resubmit loop).
 * Uses optional `workflowState` on the achievement document alongside `status` (`pending_review`, etc.).
 * maps to `status: "pending_review"` + `workflowState` flags (legacy rows may still use `pending` + flags).
 */

export type AchievementWorkflowStateShape = {
  wasReturnedForEdit?: boolean;
  resubmittedByStudent?: boolean;
  resubmittedAt?: Date;
  revisionCount?: number;
  lastAction?: string;
};

export const readWorkflowState = (raw: unknown): Record<string, unknown> =>
  raw && typeof raw === "object" && !Array.isArray(raw) ? { ...(raw as Record<string, unknown>) } : {};

export const mergeResubmitWorkflowState = (
  prev: unknown,
  input: { fromNeedsRevision: boolean; lastAction: string }
): AchievementWorkflowStateShape => {
  const p = readWorkflowState(prev);
  const prevCount =
    typeof p.revisionCount === "number" && Number.isFinite(p.revisionCount as number)
      ? (p.revisionCount as number)
      : 0;
  return {
    ...p,
    wasReturnedForEdit: input.fromNeedsRevision || p.wasReturnedForEdit === true,
    resubmittedByStudent: true,
    resubmittedAt: new Date(),
    revisionCount: prevCount + 1,
    lastAction: input.lastAction,
  };
};

export const mergeReturnedForRevisionWorkflowState = (prev: unknown): AchievementWorkflowStateShape => {
  const p = readWorkflowState(prev);
  return {
    ...p,
    wasReturnedForEdit: true,
    resubmittedByStudent: false,
    lastAction: "returned_for_revision",
  };
};
