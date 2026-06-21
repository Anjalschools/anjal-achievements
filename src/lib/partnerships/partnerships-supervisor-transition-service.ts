import mongoose from "mongoose";
import type { NextRequest } from "next/server";
import connectDB from "@/lib/mongodb";
import PartnerOrganization from "@/models/PartnerOrganization";
import { getInstitutionUserIdsForNotifications } from "@/lib/partnerships/institution-organization-resolver";
import PartnershipMessage from "@/models/PartnershipMessage";
import PartnershipThread from "@/models/PartnershipThread";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import TrainingOpportunity from "@/models/TrainingOpportunity";
import Notification from "@/models/Notification";
import { actorFromUser, logAuditEvent } from "@/lib/audit-log-service";
import type {
  StudentTrainingApplicationStatus,
  SupervisorTrainingApplicationAction,
} from "@/lib/partnerships/partnerships-constants";
import {
  appendReviewNote,
  appendTimelineEvent,
  auditActionForStatus,
  resolveSupervisorTransitionSteps,
} from "@/lib/partnerships/partnerships-application-workflow";
import { canAcceptIntoOpportunity } from "@/lib/partnerships/partnerships-quotas";
import { computeSlaDueDates } from "@/lib/partnerships/partnerships-sla";
import { getPartnershipProgramSettings } from "@/lib/partnerships/partnerships-settings-service";
import { validateApplicationTransition } from "@/lib/partnerships/partnerships-state-machine";
import {
  notifyStudentTrainingStatusChange,
  notifySupervisorTrainingMessage,
} from "@/lib/partnerships/partnerships-training-notifications";
import type { IUser } from "@/models/User";
import type { IStudentTrainingApplication } from "@/models/StudentTrainingApplication";
import { assertParentConsentAllowsFinalAcceptance } from "@/lib/partnerships/parent-consent-service";

const notifyInstitutionUsers = async (input: {
  organizationId: mongoose.Types.ObjectId;
  applicationId: string;
  opportunityTitle: string;
  studentName: string;
}) => {
  const userIds = await getInstitutionUserIdsForNotifications(String(input.organizationId));
  if (!userIds.length) return;

  const title = "طلب تدريب جديد للمراجعة";
  const message = `تم ترشيح الطالب ${input.studentName} لفرصة «${input.opportunityTitle}» لمراجعة المؤسسة.`;

  await Promise.all(
    userIds.map((userId) =>
      Notification.create({
        userId: new mongoose.Types.ObjectId(userId),
        type: "partnership_message",
        title,
        message,
        read: false,
        metadata: {
          kind: "institution_application_review",
          applicationId: input.applicationId,
          organizationId: String(input.organizationId),
        },
      })
    )
  );
};

const setupInstitutionReviewHandoff = async (input: {
  application: IStudentTrainingApplication;
  opportunityTitle: string;
  organizationId: mongoose.Types.ObjectId;
  organizationName: string;
  supervisorId: mongoose.Types.ObjectId;
  supervisorName: string;
}) => {
  const studentName = input.application.studentSnapshot?.fullName || "";
  const applicationId = String(input.application._id);

  let thread = await PartnershipThread.findOne({ applicationId: input.application._id }).exec();
  if (!thread) {
    thread = await PartnershipThread.create({
      studentId: input.application.studentId,
      applicationId: input.application._id,
      opportunityId: input.application.opportunityId,
      subject: `مراجعة مؤسسة — ${input.opportunityTitle}`.slice(0, 220),
      participantSupervisorIds: [input.supervisorId],
      studentUnreadCount: 1,
      supervisorUnreadCount: 0,
      lastMessageAt: new Date(),
    });
  }

  const body = "تم ترشيح طالب جديد لمراجعة المؤسسة.";
  thread.lastMessagePreview = body.slice(0, 280);
  thread.lastMessageAt = new Date();
  thread.studentUnreadCount = (thread.studentUnreadCount || 0) + 1;
  await thread.save();

  await PartnershipMessage.create({
    threadId: thread._id,
    senderId: input.supervisorId,
    senderRole: "supervisor",
    messageType: "system",
    body,
    metadata: { kind: "institution_handoff", automated: true },
  });

  await notifyInstitutionUsers({
    organizationId: input.organizationId,
    applicationId,
    opportunityTitle: input.opportunityTitle,
    studentName,
  });
};

export type ExecuteSupervisorTransitionInput = {
  applicationId: string;
  action: SupervisorTrainingApplicationAction;
  actor: IUser & { _id: mongoose.Types.ObjectId };
  note?: string;
  rejectionReason?: string;
  request?: NextRequest;
  skipInstitutionHandoff?: boolean;
};

export type ExecuteSupervisorTransitionResult =
  | { ok: true; application: IStudentTrainingApplication; steps: StudentTrainingApplicationStatus[] }
  | { ok: false; error: string; code?: string };

export const executeSupervisorApplicationTransition = async (
  input: ExecuteSupervisorTransitionInput
): Promise<ExecuteSupervisorTransitionResult> => {
  await connectDB();

  const application = await StudentTrainingApplication.findById(input.applicationId);
  if (!application) return { ok: false, error: "Application not found", code: "not_found" };
  if (application.archived) return { ok: false, error: "Application is archived", code: "archived" };

  const initialStatus = String(application.status || "");
  const steps = resolveSupervisorTransitionSteps(initialStatus, input.action);

  if (input.action === "accepted") {
    const parentConsentGate = await assertParentConsentAllowsFinalAcceptance(input.applicationId);
    if (!parentConsentGate.ok) {
      return {
        ok: false,
        error: parentConsentGate.error,
        code: parentConsentGate.code,
      };
    }

    const quota = await canAcceptIntoOpportunity(String(application.opportunityId));
    if (!quota.ok) {
      return {
        ok: false,
        error: "Opportunity seats are full",
        code: quota.reason || "seats_full",
      };
    }
  }

  const settings = await getPartnershipProgramSettings();
  const actorName = String(input.actor.fullNameAr || input.actor.fullName || input.actor.email || "").trim();
  const note = String(input.note || "").trim();
  const now = new Date();
  let fromStatus = initialStatus;

  for (const step of steps) {
    const transition = validateApplicationTransition(fromStatus, step);
    if (!transition.ok) {
      return { ok: false, error: transition.reason, code: "invalid_transition" };
    }

    application.status = step;
    if (step === "institution_review") {
      application.institutionStatus = "institution_pending";
    }
    application.reviewedAt = now;
    application.reviewedBy = input.actor._id;
    if (note) {
      application.reviewNotes = appendReviewNote(application.reviewNotes, note, actorName);
    }
    if (step === "rejected") {
      application.rejectionReason = String(input.rejectionReason || "").trim();
    }

    const sla = computeSlaDueDates({
      status: step,
      submittedAt: application.submittedAt,
      settings,
    });
    application.slaReviewDueAt = sla.slaReviewDueAt;
    application.slaInstitutionDueAt = sla.slaInstitutionDueAt;
    application.slaCompletionDueAt = sla.slaCompletionDueAt;

    application.timeline = appendTimelineEvent(application.timeline, {
      at: now,
      action: step,
      fromStatus,
      toStatus: step,
      actorId: String(input.actor._id),
      actorName,
      note: note || (step === "rejected" ? input.rejectionReason : undefined),
    });

    await logAuditEvent({
      actionType: auditActionForStatus(step as SupervisorTrainingApplicationAction),
      entityType: "StudentTrainingApplication",
      entityId: String(application._id),
      entityTitle: application.studentSnapshot?.fullName,
      descriptionAr: `تحديث حالة طلب تدريب: ${fromStatus} → ${step}`,
      actor: actorFromUser(input.actor),
      request: input.request,
      outcome: "success",
      metadata: {
        fromStatus,
        toStatus: step,
        note: note || undefined,
        rejectionReason: input.rejectionReason || undefined,
        chained: steps.length > 1,
      },
    });

    fromStatus = step;
  }

  await application.save();

  const opportunity = await TrainingOpportunity.findById(application.opportunityId)
    .select("title organizationId")
    .lean();
  const organization = opportunity
    ? await PartnerOrganization.findById(opportunity.organizationId).select("name").lean()
    : null;

  const finalStatus = steps[steps.length - 1];

  if (finalStatus === "institution_review" && !input.skipInstitutionHandoff && opportunity) {
    await setupInstitutionReviewHandoff({
      application,
      opportunityTitle: opportunity.title || "",
      organizationId: opportunity.organizationId as mongoose.Types.ObjectId,
      organizationName: organization?.name || "",
      supervisorId: input.actor._id,
      supervisorName: actorName,
    });
  }

  if (steps.includes("under_review") && steps.length > 1) {
    await notifyStudentTrainingStatusChange({
      studentId: application.studentId,
      applicationId: String(application._id),
      opportunityTitle: opportunity?.title || "",
      status: "under_review",
      locale: "ar",
    });
  }

  await notifyStudentTrainingStatusChange({
    studentId: application.studentId,
    applicationId: String(application._id),
    opportunityTitle: opportunity?.title || "",
    status: finalStatus,
    locale: "ar",
  });

  if (finalStatus === "accepted") {
    await notifySupervisorTrainingMessage({
      title: "اعتماد طلب تدريب",
      message: `تم اعتماد طلب ${application.studentSnapshot?.fullName || ""} لفرصة «${opportunity?.title || ""}».`,
      metadata: { applicationId: String(application._id), status: "accepted" },
    });
  }

  return { ok: true, application, steps };
};

export {
  canSupervisorApproveApplication,
  resolveSupervisorTransitionSteps,
  supervisorApprovalBlockedReason,
} from "@/lib/partnerships/partnerships-application-workflow";
