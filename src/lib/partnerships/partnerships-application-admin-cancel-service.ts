import "server-only";
import mongoose from "mongoose";
import type { NextRequest } from "next/server";
import connectDB from "@/lib/mongodb";
import { actorFromUser, logAuditEvent } from "@/lib/audit-log-service";
import Achievement from "@/models/Achievement";
import PartnerOrganization from "@/models/PartnerOrganization";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import TrainingCompletionRecord from "@/models/TrainingCompletionRecord";
import TrainingOpportunity from "@/models/TrainingOpportunity";
import {
  ADMIN_TRAINING_CANCEL_AUDIT_ACTION,
  ADMIN_TRAINING_CANCEL_BLOCKED_MESSAGE,
  ADMIN_TRAINING_CANCEL_REASONS,
  ADMIN_TRAINING_CANCEL_TIMELINE_ACTION,
  ADMINISTRATIVELY_CANCELLED_STATUS,
  resolveAdminCancelReasonLabel,
  type AdminTrainingCancelReasonCode,
} from "@/lib/partnerships/partnerships-admin-cancel-constants";
import { appendTimelineEvent } from "@/lib/partnerships/partnerships-application-workflow";
import type { IUser } from "@/models/User";

export type AdministrativelyCancelTrainingApplicationInput = {
  applicationId: string;
  actor: IUser & { _id: mongoose.Types.ObjectId };
  reasonCode: AdminTrainingCancelReasonCode | string;
  reasonNote?: string;
  request?: NextRequest;
};

export type AdministrativelyCancelTrainingApplicationResult =
  | {
      ok: true;
      applicationId: string;
      previousStatus: string;
      cancelledAt: string;
    }
  | { ok: false; error: string; errorEn?: string; code: string };

const isValidReasonCode = (code: string): code is AdminTrainingCancelReasonCode =>
  ADMIN_TRAINING_CANCEL_REASONS.some((row) => row.code === code);

export const assertApplicationCanBeAdministrativelyCancelled = async (
  applicationId: string
): Promise<{ ok: true } | { ok: false; error: string; errorEn: string; code: string }> => {
  await connectDB();
  const application = await StudentTrainingApplication.findById(applicationId).lean();
  if (!application) {
    return { ok: false, error: "Application not found", errorEn: "Application not found", code: "not_found" };
  }
  if (application.status === ADMINISTRATIVELY_CANCELLED_STATUS) {
    return {
      ok: false,
      error: "Application is already administratively cancelled",
      errorEn: "Application is already administratively cancelled",
      code: "already_cancelled",
    };
  }

  if (application.status === "completed") {
    return {
      ok: false,
      error: ADMIN_TRAINING_CANCEL_BLOCKED_MESSAGE.ar,
      errorEn: ADMIN_TRAINING_CANCEL_BLOCKED_MESSAGE.en,
      code: "completed_application",
    };
  }

  const completion = await TrainingCompletionRecord.findOne({ applicationId }).lean();
  if (completion?.achievementId) {
    const achievement = await Achievement.findById(completion.achievementId)
      .select("certificateIssued")
      .lean();
    if (achievement) {
      return {
        ok: false,
        error: ADMIN_TRAINING_CANCEL_BLOCKED_MESSAGE.ar,
        errorEn: ADMIN_TRAINING_CANCEL_BLOCKED_MESSAGE.en,
        code: "has_achievement",
      };
    }
  }
  if (completion && (completion.status === "approved" || completion.achievementId)) {
    return {
      ok: false,
      error: ADMIN_TRAINING_CANCEL_BLOCKED_MESSAGE.ar,
      errorEn: ADMIN_TRAINING_CANCEL_BLOCKED_MESSAGE.en,
      code: "has_completion_record",
    };
  }

  return { ok: true };
};

export const administrativelyCancelTrainingApplication = async (
  input: AdministrativelyCancelTrainingApplicationInput
): Promise<AdministrativelyCancelTrainingApplicationResult> => {
  const reasonCode = String(input.reasonCode || "").trim();
  if (!isValidReasonCode(reasonCode)) {
    return { ok: false, error: "Invalid cancellation reason", code: "invalid_reason" };
  }
  const reasonNote = String(input.reasonNote || "").trim().slice(0, 4000);
  if (reasonCode === "other" && !reasonNote) {
    return {
      ok: false,
      error: "Cancellation reason details are required",
      code: "reason_required",
    };
  }

  const guard = await assertApplicationCanBeAdministrativelyCancelled(input.applicationId);
  if (!guard.ok) {
    return {
      ok: false,
      error: guard.error,
      errorEn: guard.errorEn,
      code: guard.code,
    };
  }

  await connectDB();
  const application = await StudentTrainingApplication.findById(input.applicationId);
  if (!application) {
    return { ok: false, error: "Application not found", code: "not_found" };
  }

  const previousStatus = String(application.status || "");
  const now = new Date();
  const actorName = String(input.actor.fullNameAr || input.actor.fullName || input.actor.email || "").trim();
  const reasonLabelAr = resolveAdminCancelReasonLabel(reasonCode, reasonNote, true);
  const reasonLabelEn = resolveAdminCancelReasonLabel(reasonCode, reasonNote, false);

  const [opportunity, organization] = await Promise.all([
    TrainingOpportunity.findById(application.opportunityId).select("organizationId title").lean(),
    TrainingOpportunity.findById(application.opportunityId)
      .select("organizationId")
      .lean()
      .then(async (opp) =>
        opp?.organizationId
          ? PartnerOrganization.findById(opp.organizationId).select("name").lean()
          : null
      ),
  ]);

  application.status = ADMINISTRATIVELY_CANCELLED_STATUS;
  application.archived = true;
  application.archivedAt = now;
  application.adminCancelledAt = now;
  application.adminCancelledBy = input.actor._id;
  application.adminCancellationReasonCode = reasonCode;
  application.adminCancellationReasonNote = reasonNote || undefined;
  application.previousStatusBeforeAdminCancel = previousStatus;
  application.timeline = appendTimelineEvent(application.timeline, {
    at: now,
    action: ADMIN_TRAINING_CANCEL_TIMELINE_ACTION,
    fromStatus: previousStatus,
    toStatus: ADMINISTRATIVELY_CANCELLED_STATUS,
    actorId: String(input.actor._id),
    actorName,
    note: reasonLabelAr,
  });
  await application.save();

  await logAuditEvent({
    actionType: ADMIN_TRAINING_CANCEL_AUDIT_ACTION,
    entityType: "StudentTrainingApplication",
    entityId: String(application._id),
    entityTitle: application.studentSnapshot?.fullName,
    descriptionAr: `إلغاء إداري لطلب التدريب: ${reasonLabelAr}`,
    actor: actorFromUser(input.actor),
    request: input.request,
    outcome: "success",
    before: { status: previousStatus },
    after: { status: ADMINISTRATIVELY_CANCELLED_STATUS, archived: true },
    metadata: {
      applicationId: String(application._id),
      studentId: String(application.studentId),
      institutionId: opportunity?.organizationId ? String(opportunity.organizationId) : undefined,
      actorId: String(input.actor._id),
      reasonCode,
      reasonNote: reasonNote || undefined,
      reasonAr: reasonLabelAr,
      reasonEn: reasonLabelEn,
      previousStatus,
      timestamp: now.toISOString(),
      organizationName: organization?.name || undefined,
      opportunityTitle: opportunity?.title || undefined,
    },
  });

  return {
    ok: true,
    applicationId: String(application._id),
    previousStatus,
    cancelledAt: now.toISOString(),
  };
};
