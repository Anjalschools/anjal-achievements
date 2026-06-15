import "server-only";
import mongoose from "mongoose";
import type { NextRequest } from "next/server";
import connectDB from "@/lib/mongodb";
import ApplicationRequirement from "@/models/ApplicationRequirement";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import TrainingOpportunity from "@/models/TrainingOpportunity";
import { getInstitutionUserIdsForNotifications } from "@/lib/partnerships/institution-organization-resolver";
import {
  isParentConsentFileAllowed,
  mapRequirementToParentConsentDisplay,
  PARENT_CONSENT_ACCEPTANCE_BLOCKED_AR,
  PARENT_CONSENT_ACCEPTANCE_BLOCKED_EN,
  PARENT_CONSENT_DEFAULT_DESCRIPTION,
  PARENT_CONSENT_DEFAULT_TITLE,
  PARENT_CONSENT_REQUIREMENT_TYPE,
  PARENT_CONSENT_REVIEW_PENDING_AR,
  PARENT_CONSENT_REVIEW_PENDING_EN,
  PARENT_CONSENT_TIMELINE_ACTIONS,
  type ParentConsentDisplayStatus,
} from "@/lib/partnerships/parent-consent-constants";
import { appendTimelineEvent } from "@/lib/partnerships/partnerships-application-workflow";
import { notifySupervisorTrainingMessage } from "@/lib/partnerships/partnerships-training-notifications";
import Notification from "@/models/Notification";

const notifyUser = async (input: {
  userId: mongoose.Types.ObjectId;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}) => {
  await Notification.create({
    userId: input.userId,
    type: "partnership_message",
    title: input.title.trim().slice(0, 300),
    message: input.message.trim().slice(0, 4000),
    read: false,
    metadata: input.metadata,
  });
};

const appendApplicationTimeline = async (
  applicationId: string,
  event: { action: string; actorId?: string; actorName?: string; note?: string }
) => {
  const application = await StudentTrainingApplication.findById(applicationId);
  if (!application) return;
  application.timeline = appendTimelineEvent(application.timeline, {
    at: new Date(),
    action: event.action,
    actorId: event.actorId,
    actorName: event.actorName,
    note: event.note,
  });
  await application.save();
};

export const getParentConsentRequirement = async (applicationId: string) => {
  await connectDB();
  return ApplicationRequirement.findOne({
    applicationId,
    requirementType: PARENT_CONSENT_REQUIREMENT_TYPE,
  }).lean();
};

export const resolveParentConsentDisplayStatus = async (
  applicationId: string
): Promise<ParentConsentDisplayStatus> => {
  const row = await getParentConsentRequirement(applicationId);
  return mapRequirementToParentConsentDisplay(row);
};

export const assertParentConsentAllowsFinalAcceptance = async (
  applicationId: string
): Promise<{ ok: true } | { ok: false; error: string; errorEn: string; code: string }> => {
  const row = await getParentConsentRequirement(applicationId);
  if (!row || row.required === false) return { ok: true };

  if (row.status === "accepted" || row.status === "waived") return { ok: true };

  if (row.status === "submitted") {
    return {
      ok: false,
      error: PARENT_CONSENT_REVIEW_PENDING_AR,
      errorEn: PARENT_CONSENT_REVIEW_PENDING_EN,
      code: "parent_consent_review_pending",
    };
  }

  return {
    ok: false,
    error: PARENT_CONSENT_ACCEPTANCE_BLOCKED_AR,
    errorEn: PARENT_CONSENT_ACCEPTANCE_BLOCKED_EN,
    code: "parent_consent_missing",
  };
};

export const createParentConsentRequirement = async (input: {
  applicationId: string;
  organizationId: string;
  actor: { id: string; name: string; role: string };
  request?: NextRequest;
}) => {
  await connectDB();

  const existing = await ApplicationRequirement.findOne({
    applicationId: input.applicationId,
    requirementType: PARENT_CONSENT_REQUIREMENT_TYPE,
  });
  if (existing) {
    const application = await StudentTrainingApplication.findById(input.applicationId).select("studentId").lean();
    const { ensureParentConsentGeneratedTemplate } = await import(
      "@/lib/partnerships/parent-consent-template-service"
    );
    await ensureParentConsentGeneratedTemplate({
      requirementId: String(existing._id),
      applicationId: input.applicationId,
      studentId: String(application?.studentId || input.actor.id),
      actor: input.actor,
      request: input.request,
    });
    return { ok: true as const, id: String(existing._id), alreadyExists: true };
  }

  const created = await ApplicationRequirement.create({
    applicationId: input.applicationId,
    organizationId: input.organizationId,
    requirementType: PARENT_CONSENT_REQUIREMENT_TYPE,
    title: PARENT_CONSENT_DEFAULT_TITLE.ar,
    description: PARENT_CONSENT_DEFAULT_DESCRIPTION.ar,
    required: true,
    fileTypes: ["pdf", "jpg", "jpeg", "png"],
    status: "pending",
    createdBy: input.actor.id,
  });

  await appendApplicationTimeline(input.applicationId, {
    action: PARENT_CONSENT_TIMELINE_ACTIONS.requested,
    actorId: input.actor.id,
    actorName: input.actor.name,
    note: PARENT_CONSENT_DEFAULT_TITLE.ar,
  });

  const application = await StudentTrainingApplication.findById(input.applicationId).select("studentId").lean();
  if (application?.studentId) {
    await notifyUser({
      userId: application.studentId,
      title: "طلب موافقة ولي الأمر",
      message: PARENT_CONSENT_DEFAULT_DESCRIPTION.ar,
      metadata: {
        applicationId: input.applicationId,
        requirementId: String(created._id),
        kind: PARENT_CONSENT_TIMELINE_ACTIONS.requested,
      },
    });
  }

  await (async () => {
    const { ensureParentConsentGeneratedTemplate } = await import(
      "@/lib/partnerships/parent-consent-template-service"
    );
    await ensureParentConsentGeneratedTemplate({
      requirementId: String(created._id),
      applicationId: input.applicationId,
      studentId: String(application?.studentId || input.actor.id),
      actor: input.actor,
      request: input.request,
    });
  })();

  return { ok: true as const, id: String(created._id), alreadyExists: false };
};

export const notifyParentConsentUploaded = async (input: {
  applicationId: string;
  organizationId: string;
  studentName: string;
}) => {
  const institutionUserIds = await getInstitutionUserIdsForNotifications(input.organizationId);
  await Promise.all(
    institutionUserIds.map((userId) =>
      notifyUser({
        userId: new mongoose.Types.ObjectId(userId),
        title: "رفع موافقة ولي الأمر",
        message: `رفع الطالب ${input.studentName} موافقة ولي الأمر.`,
        metadata: {
          applicationId: input.applicationId,
          kind: PARENT_CONSENT_TIMELINE_ACTIONS.uploaded,
        },
      })
    )
  );

  await notifySupervisorTrainingMessage({
    title: "رفع موافقة ولي الأمر",
    message: `رفع الطالب ${input.studentName} موافقة ولي الأمر.`,
    metadata: {
      applicationId: input.applicationId,
      kind: PARENT_CONSENT_TIMELINE_ACTIONS.uploaded,
    },
  });
};

export const reviewParentConsentRequirement = async (input: {
  requirementId: string;
  decision: "approve" | "reject" | "request_reupload";
  actor: { id: string; name: string; role: string };
  note?: string;
  request?: NextRequest;
}) => {
  await connectDB();
  const requirement = await ApplicationRequirement.findById(input.requirementId);
  if (!requirement) return { ok: false as const, error: "Requirement not found", code: "not_found" };
  if (requirement.requirementType !== PARENT_CONSENT_REQUIREMENT_TYPE) {
    return { ok: false as const, error: "Not a parent consent requirement", code: "invalid_type" };
  }

  const application = await StudentTrainingApplication.findById(requirement.applicationId).lean();
  if (!application) return { ok: false as const, error: "Application not found", code: "not_found" };

  const studentId = application.studentId;

  if (input.decision === "approve") {
    requirement.status = "accepted";
    await requirement.save();
    await appendApplicationTimeline(String(requirement.applicationId), {
      action: PARENT_CONSENT_TIMELINE_ACTIONS.approved,
      actorId: input.actor.id,
      actorName: input.actor.name,
      note: input.note,
    });
    if (studentId) {
      await notifyUser({
        userId: studentId,
        title: "تم اعتماد موافقة ولي الأمر",
        message: "تم اعتماد مستند موافقة ولي الأمر. يمكن متابعة إجراءات القبول.",
        metadata: {
          applicationId: String(requirement.applicationId),
          requirementId: String(requirement._id),
          kind: PARENT_CONSENT_TIMELINE_ACTIONS.approved,
        },
      });
    }
    return { ok: true as const, status: "accepted" };
  }

  if (input.decision === "reject") {
    requirement.status = "rejected";
    await requirement.save();
    await appendApplicationTimeline(String(requirement.applicationId), {
      action: PARENT_CONSENT_TIMELINE_ACTIONS.rejected,
      actorId: input.actor.id,
      actorName: input.actor.name,
      note: input.note,
    });
    if (studentId) {
      await notifyUser({
        userId: studentId,
        title: "تم رفض موافقة ولي الأمر",
        message: input.note?.trim() || "تم رفض مستند موافقة ولي الأمر. يرجى رفع مستند صحيح.",
        metadata: {
          applicationId: String(requirement.applicationId),
          requirementId: String(requirement._id),
          kind: PARENT_CONSENT_TIMELINE_ACTIONS.rejected,
        },
      });
    }
    return { ok: true as const, status: "rejected" };
  }

  requirement.status = "pending";
  requirement.attachmentId = undefined;
  requirement.submittedAt = undefined;
  requirement.submittedBy = undefined;
  requirement.documentFingerprint = undefined;
  requirement.aiVerification = undefined;
  await requirement.save();
  await appendApplicationTimeline(String(requirement.applicationId), {
    action: PARENT_CONSENT_TIMELINE_ACTIONS.rejected,
    actorId: input.actor.id,
    actorName: input.actor.name,
    note: input.note || "طلب إعادة الرفع",
  });
  if (studentId) {
    await notifyUser({
      userId: studentId,
      title: "طلب إعادة رفع موافقة ولي الأمر",
      message: input.note?.trim() || "يرجى إعادة رفع نموذج موافقة ولي الأمر موقعاً.",
      metadata: {
        applicationId: String(requirement.applicationId),
        requirementId: String(requirement._id),
        kind: "parent_consent_reupload_requested",
      },
    });
  }
  return { ok: true as const, status: "pending" };
};

export const buildParentConsentAnalytics = async () => {
  await connectDB();
  const rows = await ApplicationRequirement.find({
    requirementType: PARENT_CONSENT_REQUIREMENT_TYPE,
  })
    .select("status aiVerification generatedTemplate templateVersionHistory")
    .lean();

  const required = rows.length;
  const uploaded = rows.filter((r) =>
    ["submitted", "accepted", "waived", "rejected"].includes(String(r.status))
  ).length;
  const approved = rows.filter((r) => r.status === "accepted" || r.status === "waived").length;

  const scored = rows
    .map((r) => (r.aiVerification as { verificationScore?: number } | undefined)?.verificationScore)
    .filter((score): score is number => typeof score === "number" && Number.isFinite(score));
  const avgConfidenceScore =
    scored.length > 0 ? Math.round((scored.reduce((sum, n) => sum + n, 0) / scored.length) * 10) / 10 : 0;
  const suspiciousCount = scored.filter((score) => score < 70).length;

  const outdatedDetectedCount = rows.filter(
    (r) =>
      (r.aiVerification as { templateVersionValidation?: { status?: string } } | undefined)?.templateVersionValidation
        ?.status === "outdated"
  ).length;
  const regeneratedCount = rows.reduce((sum, row) => {
    const history = Array.isArray(row.templateVersionHistory) ? row.templateVersionHistory.length : 0;
    const version = (row.generatedTemplate as { templateVersion?: number } | undefined)?.templateVersion || 1;
    return sum + history + Math.max(0, version - 1);
  }, 0);
  const currentTemplateCount = rows.filter(
    (r) =>
      (r.aiVerification as { templateVersionValidation?: { status?: string } } | undefined)?.templateVersionValidation
        ?.status === "current"
  ).length;
  const templateCompatibilityRate =
    uploaded > 0 ? Math.round((currentTemplateCount / uploaded) * 1000) / 10 : 0;

  return {
    required,
    uploaded,
    approved,
    suspiciousCount,
    avgConfidenceScore,
    outdatedDetectedCount,
    regeneratedCount,
    templateCompatibilityRate,
  };
};

export const resolveOrganizationIdForApplication = async (applicationId: string) => {
  await connectDB();
  const application = await StudentTrainingApplication.findById(applicationId).select("opportunityId").lean();
  if (!application) return null;
  const opportunity = await TrainingOpportunity.findById(application.opportunityId).select("organizationId").lean();
  if (!opportunity) return null;
  return String(opportunity.organizationId);
};

export { isParentConsentFileAllowed };
