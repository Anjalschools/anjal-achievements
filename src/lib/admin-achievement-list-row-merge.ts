/**
 * Merge admin PATCH JSON into list rows and keep `approvalStatus` consistent (instant UI before refetch).
 */

import { resolveWorkflowDisplayStatus, type WorkflowDisplayStatus } from "@/lib/achievementWorkflow";

const pick = (patch: Record<string, unknown>, key: string): unknown =>
  key in patch ? patch[key] : undefined;

export const mergeAdminAchievementListRow = <T extends Record<string, unknown>>(row: T, patch: Record<string, unknown>): T => {
  const rowId = String(row.id ?? "");
  const id = String(pick(patch, "id") ?? "");
  if (!id || rowId !== id) return row;

  const next: Record<string, unknown> = { ...row };

  const optionalKeys = [
    "status",
    "isFeatured",
    "featured",
    "approved",
    "pendingReReview",
    "resubmittedByStudent",
    "adminDuplicateMarked",
    "reviewNote",
    "adminWorkflowNote",
    "principalApprovedAt",
    "activitySupervisorApprovedAt",
    "adminApprovedAt",
    "judgeApprovedAt",
    "certificateIssued",
    "certificateVerificationToken",
    "certificateId",
    "certificateIssuedAt",
    "certificateRevokedAt",
    "certificateApprovedByRole",
    "certificateApprovedAt",
  ] as const;

  for (const k of optionalKeys) {
    const v = pick(patch, k);
    if (v !== undefined) next[k] = v;
  }

  const ap = pick(patch, "approvalStatus");
  if (typeof ap === "string" && ap.length > 0) {
    next.approvalStatus = ap as WorkflowDisplayStatus;
  } else {
    next.approvalStatus = resolveWorkflowDisplayStatus({
      status: next.status as string | undefined,
      isFeatured: next.isFeatured === true,
      featured: next.featured === true,
      approved: next.approved === true,
      pendingReReview: next.pendingReReview === true,
    });
  }

  return next as T;
};
