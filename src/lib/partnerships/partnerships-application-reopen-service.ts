import "server-only";
import mongoose from "mongoose";
import type { NextRequest } from "next/server";
import connectDB from "@/lib/mongodb";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import TrainingOpportunity from "@/models/TrainingOpportunity";
import { actorFromUser, logAuditEvent } from "@/lib/audit-log-service";
import {
  appendReviewNote,
  appendTimelineEvent,
} from "@/lib/partnerships/partnerships-application-workflow";
import { computeSlaDueDates } from "@/lib/partnerships/partnerships-sla";
import { getPartnershipProgramSettings } from "@/lib/partnerships/partnerships-settings-service";
import { validateReopenRejectedTrainingApplication } from "@/lib/partnerships/partnerships-state-machine";
import { notifyStudentTrainingApplicationReopened } from "@/lib/partnerships/partnerships-training-notifications";
import type { IUser } from "@/models/User";
import type { IStudentTrainingApplication } from "@/models/StudentTrainingApplication";

export type ReopenRejectedTrainingApplicationInput = {
  applicationId: string;
  actor: IUser & { _id: mongoose.Types.ObjectId };
  reason?: string;
  request?: NextRequest;
};

export type ReopenRejectedTrainingApplicationResult =
  | { ok: true; application: IStudentTrainingApplication; fromStatus: "rejected"; toStatus: "under_review" }
  | { ok: false; error: string; code?: string };

export const reopenRejectedTrainingApplication = async (
  input: ReopenRejectedTrainingApplicationInput
): Promise<ReopenRejectedTrainingApplicationResult> => {
  await connectDB();

  const application = await StudentTrainingApplication.findById(input.applicationId);
  if (!application) {
    return { ok: false, error: "Application not found", code: "not_found" };
  }
  if (application.archived) {
    return { ok: false, error: "Application is archived", code: "archived" };
  }

  const fromStatus = String(application.status || "");
  const toStatus = "under_review" as const;
  const validation = validateReopenRejectedTrainingApplication(fromStatus, toStatus);
  if (!validation.ok) {
    return { ok: false, error: validation.reason, code: "invalid_status" };
  }

  const settings = await getPartnershipProgramSettings();
  const actorName = String(input.actor.fullNameAr || input.actor.fullName || input.actor.email || "").trim();
  const reason = String(input.reason || "").trim().slice(0, 4000);
  const now = new Date();

  application.status = toStatus;
  application.reviewedAt = now;
  application.reviewedBy = input.actor._id;

  if (reason) {
    application.reviewNotes = appendReviewNote(application.reviewNotes, reason, actorName);
  }

  const sla = computeSlaDueDates({
    status: toStatus,
    submittedAt: application.submittedAt,
    settings,
  });
  application.slaReviewDueAt = sla.slaReviewDueAt;
  application.slaInstitutionDueAt = sla.slaInstitutionDueAt;
  application.slaCompletionDueAt = sla.slaCompletionDueAt;

  application.timeline = appendTimelineEvent(application.timeline, {
    at: now,
    action: "application_reopened",
    fromStatus: "rejected",
    toStatus,
    actorId: String(input.actor._id),
    actorName,
    note: reason || undefined,
  });

  await application.save();

  await logAuditEvent({
    actionType: "training_application_reopened",
    entityType: "StudentTrainingApplication",
    entityId: String(application._id),
    entityTitle: application.studentSnapshot?.fullName,
    descriptionAr: "تمت إعادة فتح طلب تدريب مرفوض وإعادته إلى مرحلة المراجعة",
    actor: actorFromUser(input.actor),
    request: input.request,
    outcome: "success",
    before: { status: fromStatus },
    after: { status: toStatus },
    metadata: {
      applicationId: String(application._id),
      fromStatus: "rejected",
      toStatus,
      actorId: String(input.actor._id),
      reason: reason || undefined,
      timestamp: now.toISOString(),
    },
  });

  const opportunity = await TrainingOpportunity.findById(application.opportunityId).select("title").lean();

  await notifyStudentTrainingApplicationReopened({
    studentId: application.studentId,
    applicationId: String(application._id),
    opportunityTitle: opportunity?.title || "",
    locale: "ar",
  });

  return { ok: true, application, fromStatus: "rejected", toStatus };
};
