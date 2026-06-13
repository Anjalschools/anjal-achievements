import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import { actorFromUser, logAuditEvent } from "@/lib/audit-log-service";
import { isValidSupervisorAction } from "@/lib/partnerships/partnerships-application-workflow";
import { executeSupervisorApplicationTransition } from "@/lib/partnerships/partnerships-supervisor-transition-service";
import type { NextRequest } from "next/server";
import type { IUser } from "@/models/User";

export type BulkApplicationOperation =
  | "accepted"
  | "rejected"
  | "institution_review"
  | "under_review"
  | "interview_requested";

const BULK_ACTIONS = new Set<BulkApplicationOperation>([
  "accepted",
  "rejected",
  "institution_review",
  "under_review",
  "interview_requested",
]);

export const isValidBulkAction = (action: string): action is BulkApplicationOperation =>
  BULK_ACTIONS.has(action as BulkApplicationOperation);

export const runBulkApplicationOperation = async (input: {
  applicationIds: string[];
  action: BulkApplicationOperation;
  note?: string;
  rejectionReason?: string;
  actor: IUser & { _id: mongoose.Types.ObjectId };
  request?: NextRequest;
}) => {
  await connectDB();
  const ids = input.applicationIds
    .map((id) => String(id || "").trim())
    .filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (!ids.length) throw new Error("No valid application ids");

  if (!isValidBulkAction(input.action) || !isValidSupervisorAction(input.action)) {
    throw new Error("Invalid bulk action");
  }
  if (input.action === "rejected" && !String(input.rejectionReason || "").trim()) {
    throw new Error("Rejection reason is required");
  }

  const results: Array<{ id: string; ok: boolean; error?: string }> = [];

  for (const id of ids) {
    try {
      const result = await executeSupervisorApplicationTransition({
        applicationId: id,
        action: input.action,
        actor: input.actor,
        note: input.note,
        rejectionReason: input.rejectionReason,
        request: input.request,
      });

      if (!result.ok) {
        results.push({ id, ok: false, error: result.code || result.error });
        continue;
      }

      results.push({ id, ok: true });
    } catch (error) {
      results.push({
        id,
        ok: false,
        error: error instanceof Error ? error.message : "error",
      });
    }
  }

  const succeeded = results.filter((row) => row.ok).length;
  const failed = results.length - succeeded;

  if (input.request) {
    await logAuditEvent({
      actionType: "partnerships_bulk_status_change",
      entityType: "StudentTrainingApplication",
      entityId: ids.join(","),
      descriptionAr: `عملية جماعية على ${results.length} طلب: ${succeeded} نجح، ${failed} فشل`,
      actor: actorFromUser(input.actor),
      request: input.request,
      outcome: failed === 0 ? "success" : succeeded > 0 ? "partial" : "failure",
      metadata: { action: input.action, succeeded, failed, total: results.length },
    });
  }

  return { action: input.action, total: results.length, succeeded, failed, results };
};
