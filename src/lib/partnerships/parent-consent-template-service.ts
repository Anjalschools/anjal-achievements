import "server-only";
import mongoose from "mongoose";
import type { NextRequest } from "next/server";
import connectDB from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit-log-service";
import ApplicationRequirement from "@/models/ApplicationRequirement";
import PartnerOrganization from "@/models/PartnerOrganization";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import TrainingAttachment from "@/models/TrainingAttachment";
import TrainingOpportunity from "@/models/TrainingOpportunity";
import User from "@/models/User";
import { uploadEvidenceBufferToR2 } from "@/lib/partnerships/evidence-r2-upload";
import { generateParentConsentPdfBuffer } from "@/lib/partnerships/parent-consent-pdf-generator";
import { PARENT_CONSENT_REQUIREMENT_TYPE, PARENT_CONSENT_TIMELINE_ACTIONS } from "@/lib/partnerships/parent-consent-constants";
import {
  PARENT_CONSENT_TEMPLATE_TIMELINE_ACTIONS,
  type ParentConsentGeneratedTemplate,
  type ParentConsentTemplateContext,
  type ParentConsentTemplateSnapshot,
  type ParentConsentTemplateVersionHistoryEntry,
} from "@/lib/partnerships/parent-consent-template-constants";
import {
  buildTemplateDataHash,
  computeTemplateFingerprint,
  computeTrainingHoursNumber,
  isOpportunityDataStaleForTemplate,
  PARENT_CONSENT_TEMPLATE_VERSION_TIMELINE_ACTIONS,
} from "@/lib/partnerships/parent-consent-template-version";
import { appendTimelineEvent } from "@/lib/partnerships/partnerships-application-workflow";

const resolveAuditActor = (actor: { id: string; name: string; role: string }) => ({
  id: mongoose.Types.ObjectId.isValid(actor.id) ? new mongoose.Types.ObjectId(actor.id) : undefined,
  name: actor.name,
  role: actor.role,
});

const formatDate = (value: Date | string | undefined | null): string => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("ar-SA");
  } catch {
    return "—";
  }
};

const computeTrainingHours = (start?: Date | null, end?: Date | null): string => {
  const hours = computeTrainingHoursNumber(start, end);
  if (!hours) return "حسب جدول المؤسسة";
  return `${hours} ساعة تقريباً`;
};

const toIsoDate = (value?: Date | string | null): string => {
  if (!value) return "";
  try {
    return new Date(value).toISOString().slice(0, 10);
  } catch {
    return "";
  }
};

export const buildParentConsentTemplateSnapshot = async (
  applicationId: string
): Promise<ParentConsentTemplateSnapshot | null> => {
  await connectDB();
  const application = await StudentTrainingApplication.findById(applicationId).lean();
  if (!application) return null;
  const opportunity = await TrainingOpportunity.findById(application.opportunityId).lean();
  if (!opportunity) return null;
  const organization = await PartnerOrganization.findById(opportunity.organizationId).select("name").lean();

  return {
    organizationName: organization?.name || "",
    opportunityTitle: opportunity.title || "",
    trainingStartDate: toIsoDate(opportunity.trainingStart),
    trainingEndDate: toIsoDate(opportunity.trainingEnd),
    trainingHours: computeTrainingHoursNumber(opportunity.trainingStart, opportunity.trainingEnd),
    academicYear: String(opportunity.academicYear || application.academicYear || application.academicYearLabel || "").trim(),
  };
};

export const resolveParentConsentTemplateStaleStatus = async (input: {
  applicationId: string;
  generatedTemplate?: ParentConsentGeneratedTemplate | null;
}) => {
  if (!input.generatedTemplate?.templateDataHash) {
    return { isStale: false, currentDataHash: "", templateDataHash: "" };
  }
  const currentSnapshot = await buildParentConsentTemplateSnapshot(input.applicationId);
  if (!currentSnapshot) {
    return { isStale: false, currentDataHash: "", templateDataHash: input.generatedTemplate.templateDataHash };
  }
  const currentDataHash = buildTemplateDataHash(currentSnapshot);
  return {
    isStale: isOpportunityDataStaleForTemplate({
      templateDataHash: input.generatedTemplate.templateDataHash,
      currentDataHash,
    }),
    currentDataHash,
    templateDataHash: input.generatedTemplate.templateDataHash,
    currentSnapshot,
    templateSnapshot: input.generatedTemplate.templateSnapshot,
    templateVersion: input.generatedTemplate.templateVersion,
  };
};

export const buildParentConsentTemplateContext = async (
  applicationId: string
): Promise<ParentConsentTemplateContext | null> => {
  await connectDB();
  const application = await StudentTrainingApplication.findById(applicationId).lean();
  if (!application) return null;

  const [opportunity, student] = await Promise.all([
    TrainingOpportunity.findById(application.opportunityId).lean(),
    User.findById(application.studentId).select("nationalId").lean(),
  ]);
  if (!opportunity) return null;

  const organization = await PartnerOrganization.findById(opportunity.organizationId)
    .select("name city sector")
    .lean();

  const appNumber = String(application._id).slice(-8).toUpperCase();
  const snapshot = application.studentSnapshot;

  return {
    studentName: snapshot?.fullName || "",
    studentNationalId: String(student?.nationalId || "").trim(),
    grade: snapshot?.grade || "",
    school: snapshot?.school || snapshot?.schoolType || "—",
    organizationName: organization?.name || "",
    opportunityTitle: opportunity.title || "",
    trainingPeriod: `${formatDate(opportunity.trainingStart)} — ${formatDate(opportunity.trainingEnd)}`,
    trainingHours: computeTrainingHours(opportunity.trainingStart, opportunity.trainingEnd),
    trainingProvider: organization?.name || "",
    applicationNumber: appNumber,
    generatedAt: new Date().toLocaleDateString("ar-SA"),
  };
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

export const ensureParentConsentGeneratedTemplate = async (input: {
  requirementId: string;
  applicationId: string;
  studentId: string;
  actor?: { id: string; name: string; role: string };
  request?: NextRequest;
  force?: boolean;
}): Promise<ParentConsentGeneratedTemplate | null> => {
  await connectDB();
  const requirement = await ApplicationRequirement.findById(input.requirementId);
  if (!requirement || requirement.requirementType !== PARENT_CONSENT_REQUIREMENT_TYPE) return null;

  const existing = requirement.generatedTemplate as ParentConsentGeneratedTemplate | undefined;
  if (existing?.storageKey && !input.force) return existing;

  const context = await buildParentConsentTemplateContext(input.applicationId);
  if (!context) return null;

  const templateSnapshot = await buildParentConsentTemplateSnapshot(input.applicationId);
  if (!templateSnapshot) return null;

  const pdfBuffer = await generateParentConsentPdfBuffer(context);
  const templateFingerprint = computeTemplateFingerprint(pdfBuffer);
  const templateDataHash = buildTemplateDataHash(templateSnapshot);
  const nextVersion = input.force && existing?.templateVersion ? existing.templateVersion + 1 : existing?.templateVersion || 1;
  const fileName = `parent-consent-${context.applicationNumber}-v${nextVersion}.pdf`;
  const uploaded = await uploadEvidenceBufferToR2({
    buffer: pdfBuffer,
    fileName,
    mimeType: "application/pdf",
  });

  const attachment = await TrainingAttachment.create({
    applicationId: input.applicationId,
    requirementId: requirement._id,
    type: "pdf",
    fileName,
    storageKey: uploaded.storageKey,
    mimeType: "application/pdf",
    fileSize: pdfBuffer.length,
    storageProvider: "r2",
    uploadedBy: input.studentId,
  });

  const generatedAt = new Date().toISOString();
  const generatedTemplate: ParentConsentGeneratedTemplate = {
    attachmentId: String(attachment._id),
    storageKey: uploaded.storageKey,
    fileName,
    generatedAt,
    templateVersion: nextVersion,
    templateGeneratedAt: generatedAt,
    templateFingerprint,
    templateDataHash,
    templateSnapshot,
    context,
  };

  if (input.force && existing?.storageKey) {
    const historyEntry: ParentConsentTemplateVersionHistoryEntry = {
      attachmentId: existing.attachmentId,
      storageKey: existing.storageKey,
      fileName: existing.fileName,
      generatedAt: existing.generatedAt,
      templateVersion: existing.templateVersion || 1,
      templateGeneratedAt: existing.templateGeneratedAt || existing.generatedAt,
      templateFingerprint: existing.templateFingerprint || "",
      templateDataHash: existing.templateDataHash || "",
      templateSnapshot: existing.templateSnapshot || templateSnapshot,
    };
    const priorHistory = Array.isArray(requirement.templateVersionHistory)
      ? (requirement.templateVersionHistory as ParentConsentTemplateVersionHistoryEntry[])
      : [];
    requirement.templateVersionHistory = [...priorHistory, historyEntry];
  }

  requirement.generatedTemplate = generatedTemplate;
  await requirement.save();

  const timelineAction = input.force
    ? PARENT_CONSENT_TEMPLATE_VERSION_TIMELINE_ACTIONS.regenerated
    : PARENT_CONSENT_TEMPLATE_TIMELINE_ACTIONS.generated;

  await appendApplicationTimeline(input.applicationId, {
    action: timelineAction,
    actorId: input.actor?.id,
    actorName: input.actor?.name,
    note: `v${nextVersion}`,
  });

  await logAuditEvent({
    actionType: input.force ? "parent_consent_template_regenerated" : "parent_consent_template_version_created",
    entityType: "ApplicationRequirement",
    entityId: String(requirement._id),
    entityTitle: requirement.title,
    descriptionAr: input.force
      ? `إعادة إنشاء نموذج موافقة ولي الأمر — الإصدار ${nextVersion}`
      : `توليد نموذج موافقة ولي الأمر — الإصدار ${nextVersion}`,
    actor: input.actor ? resolveAuditActor(input.actor) : { name: "system", role: "system" },
    request: input.request,
    after: { fileName, applicationId: input.applicationId, templateVersion: nextVersion },
    metadata: {
      applicationId: input.applicationId,
      requirementId: String(requirement._id),
      templateVersion: nextVersion,
      templateDataHash,
    },
  });

  return generatedTemplate;
};

export const regenerateParentConsentTemplate = async (input: {
  requirementId: string;
  applicationId: string;
  studentId: string;
  actor: { id: string; name: string; role: string };
  request?: NextRequest;
}) =>
  ensureParentConsentGeneratedTemplate({
    ...input,
    force: true,
  });

export const recordParentConsentTemplateDownload = async (input: {
  applicationId: string;
  requirementId: string;
  actor: { id: string; name: string; role: string };
  request?: NextRequest;
}) => {
  await appendApplicationTimeline(input.applicationId, {
    action: PARENT_CONSENT_TEMPLATE_TIMELINE_ACTIONS.downloaded,
    actorId: input.actor.id,
    actorName: input.actor.name,
  });

  await logAuditEvent({
    actionType: "parent_consent_template_downloaded",
    entityType: "ApplicationRequirement",
    entityId: input.requirementId,
    entityTitle: "موافقة ولي الأمر",
    descriptionAr: "تحميل نموذج موافقة ولي الأمر",
    actor: resolveAuditActor(input.actor),
    request: input.request,
    metadata: { applicationId: input.applicationId },
  });
};

export const getParentConsentRequirementForApplication = async (applicationId: string) => {
  await connectDB();
  return ApplicationRequirement.findOne({
    applicationId,
    requirementType: PARENT_CONSENT_REQUIREMENT_TYPE,
  }).lean();
};

export const resolveParentConsentUploadedAttachment = async (requirementId: string) => {
  await connectDB();
  const requirement = await ApplicationRequirement.findById(requirementId).lean();
  if (!requirement?.attachmentId) return null;
  return TrainingAttachment.findById(requirement.attachmentId).lean();
};

export const sanitizeParentConsentForInstitution = (
  row: Record<string, unknown> | null
): { status: string; labelAr: string; labelEn: string } | null => {
  if (!row || row.requirementType !== PARENT_CONSENT_REQUIREMENT_TYPE) return null;
  const status = String(row.status || "pending");
  if (status === "accepted" || status === "waived") {
    return { status, labelAr: "✓ معتمدة", labelEn: "✓ Approved" };
  }
  if (status === "submitted") {
    return { status, labelAr: "بانتظار الاعتماد", labelEn: "Pending approval" };
  }
  if (status === "rejected") {
    return { status, labelAr: "مرفوضة", labelEn: "Rejected" };
  }
  return { status, labelAr: "مطلوبة", labelEn: "Required" };
};
