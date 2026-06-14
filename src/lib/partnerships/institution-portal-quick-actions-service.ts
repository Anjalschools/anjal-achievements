import "server-only";
import type { NextRequest } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit-log-service";
import {
  INSTITUTION_QUICK_ACTION_TEMPLATES,
  type InstitutionQuickActionKey,
} from "@/lib/partnerships/institution-portal-constants";
import { executeInstitutionReviewDecision } from "@/lib/partnerships/institution-portal-service";
import {
  createApplicationRequirement,
  scheduleTrainingInterview,
} from "@/lib/partnerships/institution-experience-service";
import {
  sendInstitutionThreadMessage,
  sendInstitutionSupervisorMessage,
} from "@/lib/partnerships/institution-messaging-service";
import { assertInstitutionApplicationAccess } from "@/lib/partnerships/institution-scope";

export type InstitutionConversationQuickAction =
  | InstitutionQuickActionKey
  | "request_custom_document"
  | "schedule_interview"
  | "send_zoom_link"
  | "send_teams_link"
  | "send_meet_link"
  | "accept_student"
  | "reject_student"
  | "send_feedback";

const MEETING_LINK_LABELS = {
  send_zoom_link: { ar: "رابط Zoom", en: "Zoom link", prefix: "Zoom" },
  send_teams_link: { ar: "رابط Microsoft Teams", en: "Microsoft Teams link", prefix: "Teams" },
  send_meet_link: { ar: "رابط Google Meet", en: "Google Meet link", prefix: "Google Meet" },
} as const;

const auditQuickAction = async (input: {
  action: string;
  applicationId?: string;
  actor: { id: string; name: string };
  request?: NextRequest;
  metadata?: Record<string, unknown>;
}) => {
  await logAuditEvent({
    actionType: "institution_conversation_quick_action",
    entityType: "student_training_application",
    entityId: input.applicationId || "institution_supervisor_channel",
    descriptionAr: `إجراء سريع من محادثة المؤسسة: ${input.action}`,
    actor: {
      id: mongoose.Types.ObjectId.isValid(input.actor.id)
        ? new mongoose.Types.ObjectId(input.actor.id)
        : undefined,
      name: input.actor.name,
      role: "trainingInstitution",
    },
    request: input.request,
    outcome: "success",
    metadata: { action: input.action, ...input.metadata },
  });
};

export const executeInstitutionConversationQuickAction = async (input: {
  action: InstitutionConversationQuickAction;
  applicationId?: string;
  organizationId: string;
  institutionUserId: string;
  actorName: string;
  locale?: "ar" | "en";
  customTitle?: string;
  customDescription?: string;
  meetingUrl?: string;
  scheduledAt?: string;
  notes?: string;
  rejectionReason?: string;
  request?: NextRequest;
}): Promise<{ ok: true } | { ok: false; error: string; code?: string }> => {
  await connectDB();
  const locale = input.locale || "ar";
  const applicationId = String(input.applicationId || "").trim();
  const actor = { id: input.institutionUserId, name: input.actorName };

  if (input.action in INSTITUTION_QUICK_ACTION_TEMPLATES) {
    if (!applicationId) return { ok: false, error: "applicationId is required", code: "missing_application" };
    const access = await assertInstitutionApplicationAccess(applicationId, input.organizationId);
    if (!access.ok) return { ok: false, error: access.error, code: access.code };

    const key = input.action as InstitutionQuickActionKey;
    const template = INSTITUTION_QUICK_ACTION_TEMPLATES[key];
    const result = await createApplicationRequirement({
      applicationId,
      organizationId: input.organizationId,
      title: locale === "ar" ? template.requirementTitleAr : template.requirementTitleEn,
      description: locale === "ar" ? template.ar : template.en,
      required: true,
      actor,
      request: input.request,
    });
    if (!result.ok) return result;

    await sendInstitutionThreadMessage({
      applicationId,
      organizationId: input.organizationId,
      institutionUserId: input.institutionUserId,
      body: locale === "ar" ? template.ar : template.en,
      actorName: input.actorName,
    });

    await auditQuickAction({
      action: input.action,
      applicationId,
      actor,
      request: input.request,
    });
    return { ok: true };
  }

  if (input.action === "request_custom_document") {
    if (!applicationId) return { ok: false, error: "applicationId is required", code: "missing_application" };
    const title = String(input.customTitle || "").trim();
    const description = String(input.customDescription || "").trim();
    if (!title) return { ok: false, error: "customTitle is required", code: "missing_title" };

    const result = await createApplicationRequirement({
      applicationId,
      organizationId: input.organizationId,
      title,
      description,
      required: true,
      actor,
      request: input.request,
    });
    if (!result.ok) return result;

    const body =
      locale === "ar"
        ? `يرجى رفع المستند التالي: ${title}${description ? ` — ${description}` : ""}`
        : `Please upload the following document: ${title}${description ? ` — ${description}` : ""}`;

    await sendInstitutionThreadMessage({
      applicationId,
      organizationId: input.organizationId,
      institutionUserId: input.institutionUserId,
      body,
      actorName: input.actorName,
    });

    await auditQuickAction({ action: input.action, applicationId, actor, request: input.request, metadata: { title } });
    return { ok: true };
  }

  if (input.action === "schedule_interview") {
    if (!applicationId) return { ok: false, error: "applicationId is required", code: "missing_application" };
    const scheduledAt = String(input.scheduledAt || "").trim();
    if (!scheduledAt) return { ok: false, error: "scheduledAt is required", code: "missing_schedule" };

    const result = await scheduleTrainingInterview({
      applicationId,
      organizationId: input.organizationId,
      scheduledAt,
      location: "",
      meetingUrl: String(input.meetingUrl || "").trim(),
      notes: String(input.notes || "").trim(),
      actor,
      request: input.request,
    });
    if (!result.ok) return result;

    const body =
      locale === "ar"
        ? `تم جدولة مقابلة في ${new Date(scheduledAt).toLocaleString("ar-SA")}${input.meetingUrl ? ` — ${input.meetingUrl}` : ""}`
        : `Interview scheduled for ${new Date(scheduledAt).toLocaleString("en-US")}${input.meetingUrl ? ` — ${input.meetingUrl}` : ""}`;

    await sendInstitutionThreadMessage({
      applicationId,
      organizationId: input.organizationId,
      institutionUserId: input.institutionUserId,
      body,
      actorName: input.actorName,
    });

    await auditQuickAction({ action: input.action, applicationId, actor, request: input.request });
    return { ok: true };
  }

  if (input.action === "send_zoom_link" || input.action === "send_teams_link" || input.action === "send_meet_link") {
    const meetingUrl = String(input.meetingUrl || "").trim();
    if (!meetingUrl) return { ok: false, error: "meetingUrl is required", code: "missing_url" };

    const label = MEETING_LINK_LABELS[input.action];
    const body =
      locale === "ar"
        ? `${label.ar}: ${meetingUrl}`
        : `${label.en}: ${meetingUrl}`;

    if (applicationId) {
      const access = await assertInstitutionApplicationAccess(applicationId, input.organizationId);
      if (!access.ok) return { ok: false, error: access.error, code: access.code };
      await sendInstitutionThreadMessage({
        applicationId,
        organizationId: input.organizationId,
        institutionUserId: input.institutionUserId,
        body,
        actorName: input.actorName,
      });
    } else {
      await sendInstitutionSupervisorMessage({
        organizationId: input.organizationId,
        institutionUserId: input.institutionUserId,
        body,
        actorName: input.actorName,
      });
    }

    await auditQuickAction({ action: input.action, applicationId: applicationId || undefined, actor, request: input.request });
    return { ok: true };
  }

  if (input.action === "accept_student" || input.action === "reject_student") {
    if (!applicationId) return { ok: false, error: "applicationId is required", code: "missing_application" };
    const decisionAction = input.action === "accept_student" ? "accept" : "reject";
    const result = await executeInstitutionReviewDecision({
      applicationId,
      organizationId: input.organizationId,
      action: decisionAction,
      notes: String(input.notes || "").trim() || undefined,
      rejectionReason: decisionAction === "reject" ? String(input.rejectionReason || input.notes || "").trim() : undefined,
      actorName: input.actorName,
      actorId: input.institutionUserId,
      request: input.request,
    });
    if (!result.ok) return result;

    const body =
      decisionAction === "accept"
        ? locale === "ar"
          ? `تم قبول طلب التدريب.${input.notes ? ` ملاحظات: ${input.notes}` : ""}`
          : `Training application accepted.${input.notes ? ` Notes: ${input.notes}` : ""}`
        : locale === "ar"
          ? `تم رفض طلب التدريب.${input.rejectionReason || input.notes ? ` السبب: ${input.rejectionReason || input.notes}` : ""}`
          : `Training application rejected.${input.rejectionReason || input.notes ? ` Reason: ${input.rejectionReason || input.notes}` : ""}`;

    await sendInstitutionThreadMessage({
      applicationId,
      organizationId: input.organizationId,
      institutionUserId: input.institutionUserId,
      body,
      actorName: input.actorName,
    });

    await auditQuickAction({ action: input.action, applicationId, actor, request: input.request });
    return { ok: true };
  }

  if (input.action === "send_feedback") {
    const notes = String(input.notes || "").trim();
    if (!notes) return { ok: false, error: "notes are required", code: "missing_notes" };

    if (applicationId) {
      const access = await assertInstitutionApplicationAccess(applicationId, input.organizationId);
      if (!access.ok) return { ok: false, error: access.error, code: access.code };
      await sendInstitutionThreadMessage({
        applicationId,
        organizationId: input.organizationId,
        institutionUserId: input.institutionUserId,
        body: notes,
        actorName: input.actorName,
      });
    } else {
      await sendInstitutionSupervisorMessage({
        organizationId: input.organizationId,
        institutionUserId: input.institutionUserId,
        body: notes,
        actorName: input.actorName,
      });
    }

    await auditQuickAction({ action: input.action, applicationId: applicationId || undefined, actor, request: input.request });
    return { ok: true };
  }

  return { ok: false, error: "Invalid action", code: "invalid_action" };
};
