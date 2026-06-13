import mongoose from "mongoose";
import type { NextRequest } from "next/server";
import connectDB from "@/lib/mongodb";
import ApplicationRequirement from "@/models/ApplicationRequirement";
import InstitutionReview from "@/models/InstitutionReview";
import Notification from "@/models/Notification";
import PartnerOrganization from "@/models/PartnerOrganization";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import TrainingAssessment from "@/models/TrainingAssessment";
import TrainingAttachment from "@/models/TrainingAttachment";
import TrainingInterview from "@/models/TrainingInterview";
import { logAuditEvent } from "@/lib/audit-log-service";
import { appendTimelineEvent } from "@/lib/partnerships/partnerships-application-workflow";
import type { InstitutionFinalRecommendation } from "@/lib/partnerships/institution-experience-constants";
import {
  bindInstitutionUserToOrganization,
  getInstitutionUserIdsForNotifications,
} from "@/lib/partnerships/institution-organization-resolver";
import { notifySchoolOnInstitutionEvaluationSubmitted } from "@/lib/partnerships/institution-school-approval-service";
import { assertInstitutionApplicationAccess } from "@/lib/partnerships/institution-scope";
import { validateApplicationTransition } from "@/lib/partnerships/partnerships-state-machine";

const preview = (text: string) => String(text || "").trim().slice(0, 280);

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
  event: {
    action: string;
    actorId?: string;
    actorName?: string;
    note?: string;
  }
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

const auditInstitutionAction = async (input: {
  actionType: string;
  entityType: string;
  entityId: string;
  entityTitle?: string;
  descriptionAr: string;
  actor: { id?: string; name: string; role: string };
  request?: NextRequest;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}) => {
  await logAuditEvent({
    actionType: input.actionType,
    entityType: input.entityType,
    entityId: input.entityId,
    entityTitle: input.entityTitle,
    descriptionAr: input.descriptionAr,
    actor: {
      id:
        input.actor.id && mongoose.Types.ObjectId.isValid(input.actor.id)
          ? new mongoose.Types.ObjectId(input.actor.id)
          : undefined,
      name: input.actor.name,
      role: input.actor.role,
    },
    request: input.request,
    outcome: "success",
    before: input.before,
    after: input.after,
    metadata: input.metadata,
  });
};

export const linkInstitutionUserToOrganization = async (
  userId: string,
  organizationId: string
): Promise<void> => {
  await bindInstitutionUserToOrganization(organizationId, userId);
};

export const listApplicationRequirements = async (applicationId: string, organizationId: string) => {
  const access = await assertInstitutionApplicationAccess(applicationId, organizationId);
  if (!access.ok) return { ok: false as const, error: access.error, code: access.code };

  const rows = await ApplicationRequirement.find({ applicationId })
    .sort({ createdAt: 1 })
    .lean();

  return {
    ok: true as const,
    items: rows.map((row) => ({
      id: String(row._id),
      title: row.title,
      description: row.description || "",
      required: row.required !== false,
      fileTypes: row.fileTypes || [],
      dueDate: row.dueDate ? new Date(row.dueDate).toISOString() : null,
      status: row.status,
      submittedAt: row.submittedAt ? new Date(row.submittedAt).toISOString() : null,
    })),
  };
};

export const createApplicationRequirement = async (input: {
  applicationId: string;
  organizationId: string;
  title: string;
  description?: string;
  required?: boolean;
  fileTypes?: string[];
  dueDate?: string;
  actor: { id: string; name: string };
  request?: NextRequest;
}) => {
  const access = await assertInstitutionApplicationAccess(input.applicationId, input.organizationId);
  if (!access.ok) return { ok: false as const, error: access.error, code: access.code };

  const created = await ApplicationRequirement.create({
    applicationId: input.applicationId,
    organizationId: input.organizationId,
    title: input.title.trim(),
    description: input.description?.trim(),
    required: input.required !== false,
    fileTypes: input.fileTypes || [],
    dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
    status: "pending",
    createdBy: input.actor.id,
  });

  await appendApplicationTimeline(input.applicationId, {
    action: "institution_requirement_created",
    actorId: input.actor.id,
    actorName: input.actor.name,
    note: input.title,
  });

  await auditInstitutionAction({
    actionType: "institution_requirement_created",
    entityType: "ApplicationRequirement",
    entityId: String(created._id),
    entityTitle: input.title,
    descriptionAr: `طلب مستند من المؤسسة: ${input.title}`,
    actor: { id: input.actor.id, name: input.actor.name, role: "trainingInstitution" },
    request: input.request,
    after: { title: input.title, applicationId: input.applicationId },
  });

  const application = await StudentTrainingApplication.findById(input.applicationId).select("studentId").lean();
  if (application?.studentId) {
    await notifyUser({
      userId: application.studentId,
      title: "طلب مستند — التدريب الصيفي",
      message: `المؤسسة التدريبية تطلب مستنداً: ${input.title}`,
      metadata: {
        applicationId: input.applicationId,
        requirementId: String(created._id),
        kind: "institution_requirement_created",
      },
    });
  }

  return { ok: true as const, id: String(created._id) };
};

export const submitApplicationRequirement = async (input: {
  requirementId: string;
  studentId: string;
  attachment: { type: string; fileName: string; storageKey: string };
  request?: NextRequest;
}) => {
  await connectDB();
  const requirement = await ApplicationRequirement.findById(input.requirementId);
  if (!requirement) return { ok: false as const, error: "Requirement not found", code: "not_found" };

  const application = await StudentTrainingApplication.findById(requirement.applicationId).lean();
  if (!application || String(application.studentId) !== String(input.studentId)) {
    return { ok: false as const, error: "Forbidden", code: "forbidden" };
  }

  const attachment = await TrainingAttachment.create({
    applicationId: requirement.applicationId,
    requirementId: requirement._id,
    type: input.attachment.type,
    fileName: input.attachment.fileName,
    storageKey: input.attachment.storageKey,
    uploadedBy: input.studentId,
  });

  requirement.status = "submitted";
  requirement.attachmentId = attachment._id;
  requirement.submittedAt = new Date();
  requirement.submittedBy = new mongoose.Types.ObjectId(input.studentId);
  await requirement.save();

  await appendApplicationTimeline(String(requirement.applicationId), {
    action: "institution_requirement_submitted",
    actorId: input.studentId,
    note: requirement.title,
  });

  await auditInstitutionAction({
    actionType: "institution_requirement_submitted",
    entityType: "ApplicationRequirement",
    entityId: String(requirement._id),
    entityTitle: requirement.title,
    descriptionAr: `رفع مستند: ${requirement.title}`,
    actor: { id: input.studentId, name: "student", role: "student" },
    request: input.request,
    after: { status: "submitted", attachmentId: String(attachment._id) },
  });

  const institutionUserIds = await getInstitutionUserIdsForNotifications(String(requirement.organizationId));
  await Promise.all(
    institutionUserIds.map((userId) =>
      notifyUser({
        userId: new mongoose.Types.ObjectId(userId),
        title: "رفع مستند — التدريب الصيفي",
        message: `رفع الطالب مستنداً: ${requirement.title}`,
        metadata: {
          applicationId: String(requirement.applicationId),
          requirementId: String(requirement._id),
          kind: "institution_requirement_submitted",
        },
      })
    )
  );

  return { ok: true as const };
};

export const listTrainingInterviews = async (applicationId: string, organizationId: string) => {
  const access = await assertInstitutionApplicationAccess(applicationId, organizationId);
  if (!access.ok) return { ok: false as const, error: access.error, code: access.code };

  const rows = await TrainingInterview.find({ applicationId }).sort({ scheduledAt: -1 }).lean();
  return {
    ok: true as const,
    items: rows.map((row) => ({
      id: String(row._id),
      scheduledAt: new Date(row.scheduledAt).toISOString(),
      location: row.location || "",
      meetingUrl: row.meetingUrl || "",
      notes: row.notes || "",
      status: row.status,
    })),
  };
};

export const scheduleTrainingInterview = async (input: {
  applicationId: string;
  organizationId: string;
  scheduledAt: string;
  location?: string;
  meetingUrl?: string;
  notes?: string;
  actor: { id: string; name: string };
  request?: NextRequest;
}) => {
  const access = await assertInstitutionApplicationAccess(input.applicationId, input.organizationId);
  if (!access.ok) return { ok: false as const, error: access.error, code: access.code };

  const created = await TrainingInterview.create({
    applicationId: input.applicationId,
    organizationId: input.organizationId,
    scheduledAt: new Date(input.scheduledAt),
    location: input.location?.trim(),
    meetingUrl: input.meetingUrl?.trim(),
    notes: input.notes?.trim(),
    status: "scheduled",
    createdBy: input.actor.id,
  });

  await appendApplicationTimeline(input.applicationId, {
    action: "institution_interview_scheduled",
    actorId: input.actor.id,
    actorName: input.actor.name,
    note: input.scheduledAt,
  });

  await auditInstitutionAction({
    actionType: "institution_interview_scheduled",
    entityType: "TrainingInterview",
    entityId: String(created._id),
    descriptionAr: "جدولة مقابلة من المؤسسة",
    actor: { id: input.actor.id, name: input.actor.name, role: "trainingInstitution" },
    request: input.request,
    after: { scheduledAt: input.scheduledAt },
    metadata: { applicationId: input.applicationId },
  });

  const application = await StudentTrainingApplication.findById(input.applicationId).select("studentId").lean();
  if (application?.studentId) {
    await notifyUser({
      userId: application.studentId,
      title: "جدولة مقابلة — التدريب الصيفي",
      message: `تم جدولة مقابلة في ${new Date(input.scheduledAt).toLocaleString("ar-SA")}`,
      metadata: {
        applicationId: input.applicationId,
        interviewId: String(created._id),
        kind: "institution_interview_scheduled",
      },
    });
  }

  return { ok: true as const, id: String(created._id) };
};

export const updateTrainingInterview = async (input: {
  interviewId: string;
  organizationId: string;
  scheduledAt?: string;
  location?: string;
  meetingUrl?: string;
  notes?: string;
  status?: "scheduled" | "completed" | "cancelled" | "rescheduled";
  actor: { id: string; name: string };
  request?: NextRequest;
}) => {
  const interview = await TrainingInterview.findById(input.interviewId);
  if (!interview || String(interview.organizationId) !== String(input.organizationId)) {
    return { ok: false as const, error: "Interview not found", code: "not_found" };
  }

  const before = {
    scheduledAt: interview.scheduledAt,
    status: interview.status,
  };

  if (input.scheduledAt) interview.scheduledAt = new Date(input.scheduledAt);
  if (input.location !== undefined) interview.location = input.location.trim();
  if (input.meetingUrl !== undefined) interview.meetingUrl = input.meetingUrl.trim();
  if (input.notes !== undefined) interview.notes = input.notes.trim();
  if (input.status) interview.status = input.status;
  await interview.save();

  const action =
    input.status === "cancelled" ? "institution_interview_cancelled" : "institution_interview_updated";

  await appendApplicationTimeline(String(interview.applicationId), {
    action,
    actorId: input.actor.id,
    actorName: input.actor.name,
    note: input.status || undefined,
  });

  await auditInstitutionAction({
    actionType: action,
    entityType: "TrainingInterview",
    entityId: String(interview._id),
    descriptionAr: input.status === "cancelled" ? "إلغاء مقابلة" : "تحديث مقابلة",
    actor: { id: input.actor.id, name: input.actor.name, role: "trainingInstitution" },
    request: input.request,
    before,
    after: { scheduledAt: interview.scheduledAt, status: interview.status },
  });

  const application = await StudentTrainingApplication.findById(interview.applicationId).select("studentId").lean();
  if (application?.studentId) {
    await notifyUser({
      userId: application.studentId,
      title: input.status === "cancelled" ? "إلغاء مقابلة" : "تحديث مقابلة",
      message:
        input.status === "cancelled"
          ? "تم إلغاء المقابلة المجدولة."
          : `تم تحديث موعد المقابلة: ${new Date(interview.scheduledAt).toLocaleString("ar-SA")}`,
      metadata: {
        applicationId: String(interview.applicationId),
        interviewId: String(interview._id),
        kind: action,
      },
    });
  }

  return { ok: true as const };
};

export const listTrainingAssessments = async (applicationId: string, organizationId: string) => {
  const access = await assertInstitutionApplicationAccess(applicationId, organizationId);
  if (!access.ok) return { ok: false as const, error: access.error, code: access.code };

  const rows = await TrainingAssessment.find({ applicationId }).sort({ createdAt: -1 }).lean();
  return {
    ok: true as const,
    items: rows.map((row) => ({
      id: String(row._id),
      type: row.type,
      title: row.title,
      description: row.description || "",
      externalUrl: row.externalUrl || "",
      dueDate: row.dueDate ? new Date(row.dueDate).toISOString() : null,
      status: row.status,
      submittedAt: row.submittedAt ? new Date(row.submittedAt).toISOString() : null,
      submissionNotes: row.submissionNotes || "",
    })),
  };
};

export const createTrainingAssessment = async (input: {
  applicationId: string;
  organizationId: string;
  type: "external_link" | "upload_task" | "questionnaire";
  title: string;
  description?: string;
  externalUrl?: string;
  dueDate?: string;
  actor: { id: string; name: string };
  request?: NextRequest;
}) => {
  const access = await assertInstitutionApplicationAccess(input.applicationId, input.organizationId);
  if (!access.ok) return { ok: false as const, error: access.error, code: access.code };

  const created = await TrainingAssessment.create({
    applicationId: input.applicationId,
    organizationId: input.organizationId,
    type: input.type,
    title: input.title.trim(),
    description: input.description?.trim(),
    externalUrl: input.externalUrl?.trim(),
    dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
    status: "pending",
    createdBy: input.actor.id,
  });

  await appendApplicationTimeline(input.applicationId, {
    action: "institution_assessment_created",
    actorId: input.actor.id,
    actorName: input.actor.name,
    note: input.title,
  });

  await auditInstitutionAction({
    actionType: "institution_assessment_created",
    entityType: "TrainingAssessment",
    entityId: String(created._id),
    entityTitle: input.title,
    descriptionAr: `إنشاء تقييم: ${input.title}`,
    actor: { id: input.actor.id, name: input.actor.name, role: "trainingInstitution" },
    request: input.request,
    after: { type: input.type, title: input.title },
  });

  const application = await StudentTrainingApplication.findById(input.applicationId).select("studentId").lean();
  if (application?.studentId) {
    await notifyUser({
      userId: application.studentId,
      title: "تقييم جديد — التدريب الصيفي",
      message: `المؤسسة أضافت تقييماً: ${input.title}`,
      metadata: {
        applicationId: input.applicationId,
        assessmentId: String(created._id),
        kind: "institution_assessment_created",
      },
    });
  }

  return { ok: true as const, id: String(created._id) };
};

export const submitTrainingAssessment = async (input: {
  assessmentId: string;
  studentId: string;
  submissionNotes?: string;
  attachment?: { type: string; fileName: string; storageKey: string };
  request?: NextRequest;
}) => {
  const assessment = await TrainingAssessment.findById(input.assessmentId);
  if (!assessment) return { ok: false as const, error: "Assessment not found", code: "not_found" };

  const application = await StudentTrainingApplication.findById(assessment.applicationId).lean();
  if (!application || String(application.studentId) !== String(input.studentId)) {
    return { ok: false as const, error: "Forbidden", code: "forbidden" };
  }

  if (input.attachment) {
    const attachment = await TrainingAttachment.create({
      applicationId: assessment.applicationId,
      type: input.attachment.type,
      fileName: input.attachment.fileName,
      storageKey: input.attachment.storageKey,
      uploadedBy: input.studentId,
    });
    assessment.submissionAttachmentId = attachment._id;
  }

  assessment.status = "submitted";
  assessment.submissionNotes = input.submissionNotes?.trim();
  assessment.submittedAt = new Date();
  assessment.submittedBy = new mongoose.Types.ObjectId(input.studentId);
  await assessment.save();

  await appendApplicationTimeline(String(assessment.applicationId), {
    action: "institution_assessment_submitted",
    actorId: input.studentId,
    note: assessment.title,
  });

  const institutionUserIds = await getInstitutionUserIdsForNotifications(String(assessment.organizationId));
  await Promise.all(
    institutionUserIds.map((userId) =>
      notifyUser({
        userId: new mongoose.Types.ObjectId(userId),
        title: "تسليم تقييم",
        message: `سلّم الطالب تقييماً: ${assessment.title}`,
        metadata: {
          applicationId: String(assessment.applicationId),
          assessmentId: String(assessment._id),
          kind: "institution_assessment_submitted",
        },
      })
    )
  );

  return { ok: true as const };
};

export const submitInstitutionCompletionEvaluation = async (input: {
  applicationId: string;
  organizationId: string;
  commitment: number;
  attendance: number;
  discipline: number;
  communication: number;
  teamwork: number;
  technicalSkills: number;
  professionalSkills: number;
  strengths?: string;
  improvementAreas?: string;
  finalRecommendation: InstitutionFinalRecommendation;
  institutionNotes?: string;
  actor: { id: string; name: string };
  request?: NextRequest;
}) => {
  const access = await assertInstitutionApplicationAccess(input.applicationId, input.organizationId);
  if (!access.ok) return { ok: false as const, error: access.error, code: access.code };

  if (access.scope.status !== "accepted") {
    return { ok: false as const, error: "Final evaluation allowed only after accepted training", code: "invalid_status" };
  }

  const existing = await InstitutionReview.findOne({
    applicationId: input.applicationId,
    reviewKind: "completion_evaluation",
  }).lean();
  if (existing) {
    return { ok: false as const, error: "Final evaluation already submitted", code: "already_submitted" };
  }

  const transition = validateApplicationTransition(access.scope.status, "awaiting_school_approval");
  if (!transition.ok) {
    return { ok: false as const, error: transition.reason, code: "invalid_transition" };
  }

  const now = new Date();
  const review = await InstitutionReview.create({
    applicationId: input.applicationId,
    organizationId: input.organizationId,
    decision: "institution_training_evaluated",
    reviewKind: "completion_evaluation",
    reviewedAt: now,
    commitment: input.commitment,
    attendance: input.attendance,
    discipline: input.discipline,
    communication: input.communication,
    teamwork: input.teamwork,
    technicalSkills: input.technicalSkills,
    professionalSkills: input.professionalSkills,
    strengths: input.strengths?.trim(),
    improvementAreas: input.improvementAreas?.trim(),
    finalRecommendation: input.finalRecommendation,
    institutionNotes: input.institutionNotes?.trim(),
  });

  const application = await StudentTrainingApplication.findById(input.applicationId);
  if (!application) return { ok: false as const, error: "Application not found", code: "not_found" };

  const fromStatus = application.status;
  application.status = "awaiting_school_approval";
  application.timeline = appendTimelineEvent(application.timeline, {
    at: now,
    action: "institution_training_evaluated",
    fromStatus,
    toStatus: "awaiting_school_approval",
    actorId: input.actor.id,
    actorName: input.actor.name,
    note: input.finalRecommendation,
  });
  await application.save();

  await auditInstitutionAction({
    actionType: "institution_training_evaluated",
    entityType: "InstitutionReview",
    entityId: String(review._id),
    descriptionAr: "تقييم المؤسسة بعد اكتمال التدريب",
    actor: { id: input.actor.id, name: input.actor.name, role: "trainingInstitution" },
    request: input.request,
    after: {
      finalRecommendation: input.finalRecommendation,
      commitment: input.commitment,
      attendance: input.attendance,
    },
    metadata: { applicationId: input.applicationId },
  });

  const applicationLean = await StudentTrainingApplication.findById(input.applicationId)
    .select("studentId studentSnapshot")
    .lean();
  if (applicationLean?.studentId) {
    await notifyUser({
      userId: applicationLean.studentId,
      title: "تقييم التدريب",
      message: "أكملت المؤسسة تقييمك بعد التدريب وبانتظار اعتماد المدرسة.",
      metadata: {
        applicationId: input.applicationId,
        reviewId: String(review._id),
        kind: "institution_training_evaluated",
      },
    });
  }

  const organization = await PartnerOrganization.findById(input.organizationId).select("name").lean();
  await notifySchoolOnInstitutionEvaluationSubmitted({
    applicationId: input.applicationId,
    studentName: application.studentSnapshot?.fullName || "",
    organizationName: organization?.name || "",
  });

  return { ok: true as const, id: String(review._id) };
};

export const getInstitutionEvaluationForApplication = async (applicationId: string) => {
  const row = await InstitutionReview.findOne({
    applicationId,
    reviewKind: "completion_evaluation",
  })
    .sort({ reviewedAt: -1 })
    .lean();

  if (!row) return null;

  return {
    id: String(row._id),
    commitment: row.commitment,
    attendance: row.attendance,
    discipline: row.discipline,
    communication: row.communication,
    teamwork: row.teamwork,
    technicalSkills: row.technicalSkills,
    professionalSkills: row.professionalSkills,
    strengths: row.strengths || "",
    improvementAreas: row.improvementAreas || "",
    finalRecommendation: row.finalRecommendation,
    institutionNotes: row.institutionNotes || "",
    reviewedAt: row.reviewedAt ? new Date(row.reviewedAt).toISOString() : null,
  };
};

export const listStudentApplicationRequirements = async (applicationId: string, studentId: string) => {
  const application = await StudentTrainingApplication.findById(applicationId).lean();
  if (!application || String(application.studentId) !== String(studentId)) {
    return { ok: false as const, error: "Forbidden", code: "forbidden" };
  }

  const rows = await ApplicationRequirement.find({ applicationId }).sort({ createdAt: 1 }).lean();
  return {
    ok: true as const,
    items: rows.map((row) => ({
      id: String(row._id),
      title: row.title,
      description: row.description || "",
      required: row.required !== false,
      fileTypes: row.fileTypes || [],
      dueDate: row.dueDate ? new Date(row.dueDate).toISOString() : null,
      status: row.status,
    })),
  };
};

export const listStudentTrainingAssessments = async (applicationId: string, studentId: string) => {
  const application = await StudentTrainingApplication.findById(applicationId).lean();
  if (!application || String(application.studentId) !== String(studentId)) {
    return { ok: false as const, error: "Forbidden", code: "forbidden" };
  }

  const rows = await TrainingAssessment.find({ applicationId }).sort({ createdAt: -1 }).lean();
  return {
    ok: true as const,
    items: rows.map((row) => ({
      id: String(row._id),
      type: row.type,
      title: row.title,
      description: row.description || "",
      externalUrl: row.externalUrl || "",
      dueDate: row.dueDate ? new Date(row.dueDate).toISOString() : null,
      status: row.status,
    })),
  };
};
