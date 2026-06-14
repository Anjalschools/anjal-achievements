import mongoose from "mongoose";
import type { NextRequest } from "next/server";
import connectDB from "@/lib/mongodb";
import InstitutionReview from "@/models/InstitutionReview";
import PartnerOrganization from "@/models/PartnerOrganization";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import TrainingOpportunity from "@/models/TrainingOpportunity";
import { logAuditEvent } from "@/lib/audit-log-service";
import {
  appendTimelineEvent,
  auditActionForStatus,
} from "@/lib/partnerships/partnerships-application-workflow";
import { canAcceptIntoOpportunity } from "@/lib/partnerships/partnerships-quotas";
import { computeSlaDueDates } from "@/lib/partnerships/partnerships-sla";
import { getPartnershipProgramSettings } from "@/lib/partnerships/partnerships-settings-service";
import { validateApplicationTransition } from "@/lib/partnerships/partnerships-state-machine";
import type { InstitutionDecisionStatus } from "@/lib/partnerships/partnerships-messaging-constants";
import {
  notifyStudentTrainingStatusChange,
  notifySupervisorTrainingMessage,
} from "@/lib/partnerships/partnerships-training-notifications";
import {
  notifySchoolOnInstitutionDecision,
} from "@/lib/partnerships/institution-school-approval-service";
import type { StudentTrainingApplicationStatus } from "@/lib/partnerships/partnerships-constants";
import { buildInstitutionStudentProfileSummary } from "@/lib/partnerships/institution-student-profile-service";
import {
  getInstitutionEvaluationForApplication,
  listApplicationRequirements,
  listTrainingAssessments,
  listTrainingInterviews,
} from "@/lib/partnerships/institution-experience-service";
import { resolveInstitutionStudentContactView } from "@/lib/partnerships/institution-contact-access-service";
import {
  buildCandidateScorecard,
  buildDocumentTracker,
  listInstitutionCandidateTags,
  listInstitutionPrivateNotes,
} from "@/lib/partnerships/institution-candidate-pipeline-service";

export type InstitutionReviewAction = "accept" | "reject" | "interview";

const ACTION_TO_STATUS: Record<InstitutionReviewAction, StudentTrainingApplicationStatus> = {
  accept: "accepted",
  reject: "rejected",
  interview: "interview_requested",
};

const ACTION_TO_INSTITUTION_STATUS: Record<InstitutionReviewAction, InstitutionDecisionStatus> = {
  accept: "institution_accepted",
  reject: "institution_rejected",
  interview: "institution_interview",
};

export type ExecuteInstitutionReviewInput = {
  applicationId: string;
  organizationId: string;
  action: InstitutionReviewAction;
  notes?: string;
  rejectionReason?: string;
  actorName: string;
  actorId?: string;
  request?: NextRequest;
};

export const executeInstitutionReviewDecision = async (
  input: ExecuteInstitutionReviewInput
): Promise<{ ok: true } | { ok: false; error: string; code?: string }> => {
  await connectDB();

  if (!mongoose.Types.ObjectId.isValid(input.applicationId)) {
    return { ok: false, error: "Invalid application id", code: "invalid_id" };
  }

  const application = await StudentTrainingApplication.findById(input.applicationId);
  if (!application) return { ok: false, error: "Application not found", code: "not_found" };

  const opportunity = await TrainingOpportunity.findById(application.opportunityId).lean();
  if (!opportunity || String(opportunity.organizationId) !== String(input.organizationId)) {
    return { ok: false, error: "Application not in organization scope", code: "forbidden" };
  }

  if (application.status !== "institution_review") {
    return {
      ok: false,
      error: "Application is not awaiting institution review",
      code: "invalid_status",
    };
  }

  const nextStatus = ACTION_TO_STATUS[input.action];
  const transition = validateApplicationTransition(application.status, nextStatus);
  if (!transition.ok) {
    return { ok: false, error: transition.reason, code: "invalid_transition" };
  }

  if (input.action === "reject" && !String(input.rejectionReason || input.notes || "").trim()) {
    return { ok: false, error: "Rejection reason is required", code: "rejection_reason_required" };
  }

  if (input.action === "accept") {
    const quota = await canAcceptIntoOpportunity(String(application.opportunityId));
    if (!quota.ok) {
      return { ok: false, error: "Opportunity seats are full", code: quota.reason || "seats_full" };
    }
  }

  const settings = await getPartnershipProgramSettings();
  const now = new Date();
  const fromStatus = application.status;
  const institutionStatus = ACTION_TO_INSTITUTION_STATUS[input.action];
  const note = String(input.notes || "").trim();
  const rejectionReason = String(input.rejectionReason || input.notes || "").trim();

  await InstitutionReview.create({
    applicationId: application._id,
    organizationId: input.organizationId,
    decision: institutionStatus,
    notes: note || undefined,
    reviewedAt: now,
  });

  application.status = nextStatus;
  application.institutionStatus = institutionStatus;
  application.reviewedAt = now;
  if (input.action === "reject") {
    application.rejectionReason = rejectionReason;
  }

  const sla = computeSlaDueDates({
    status: nextStatus,
    submittedAt: application.submittedAt,
    settings,
  });
  application.slaReviewDueAt = sla.slaReviewDueAt;
  application.slaInstitutionDueAt = sla.slaInstitutionDueAt;
  application.slaCompletionDueAt = sla.slaCompletionDueAt;

  application.timeline = appendTimelineEvent(application.timeline, {
    at: now,
    action: "institution_decision",
    fromStatus,
    toStatus: nextStatus,
    actorId: input.actorId,
    actorName: input.actorName,
    note: note || rejectionReason || undefined,
  });

  application.timeline = appendTimelineEvent(application.timeline, {
    at: now,
    action: nextStatus,
    fromStatus,
    toStatus: nextStatus,
    actorId: input.actorId,
    actorName: input.actorName,
    note: note || (input.action === "reject" ? rejectionReason : undefined),
  });

  await application.save();

  const organization = await PartnerOrganization.findById(input.organizationId).select("name").lean();

  await logAuditEvent({
    actionType: auditActionForStatus(
      nextStatus === "accepted"
        ? "accepted"
        : nextStatus === "rejected"
          ? "rejected"
          : "interview_requested"
    ),
    entityType: "StudentTrainingApplication",
    entityId: String(application._id),
    entityTitle: application.studentSnapshot?.fullName,
    descriptionAr: `قرار مؤسسة (${organization?.name || ""}): ${nextStatus}`,
    actor: {
      id: input.actorId && mongoose.Types.ObjectId.isValid(input.actorId)
        ? new mongoose.Types.ObjectId(input.actorId)
        : undefined,
      name: input.actorName,
      role: "trainingInstitution",
    },
    request: input.request,
    outcome: "success",
    metadata: {
      fromStatus,
      toStatus: nextStatus,
      institutionStatus,
      note: note || undefined,
      rejectionReason: input.action === "reject" ? rejectionReason : undefined,
      organizationId: input.organizationId,
    },
  });

  await notifyStudentTrainingStatusChange({
    studentId: application.studentId,
    applicationId: String(application._id),
    opportunityTitle: opportunity.title || "",
    status: nextStatus,
    locale: "ar",
  });

  await notifySupervisorTrainingMessage({
    title:
      input.action === "accept"
        ? "قبول مؤسسة — تدريب صيفي"
        : input.action === "reject"
          ? "رفض مؤسسة — تدريب صيفي"
          : "طلب مقابلة — مؤسسة تدريب",
    message: `${input.actorName}: ${application.studentSnapshot?.fullName || ""} — ${opportunity.title || ""}`,
    metadata: {
      applicationId: String(application._id),
      status: nextStatus,
      institutionStatus,
      organizationId: input.organizationId,
    },
  });

  if (input.action === "accept" || input.action === "reject") {
    await notifySchoolOnInstitutionDecision({
      applicationId: String(application._id),
      studentName: application.studentSnapshot?.fullName || "",
      organizationName: organization?.name || "",
      decision: input.action === "accept" ? "accepted" : "rejected",
    });
  }

  return { ok: true };
};

export const listInstitutionApplications = async (organizationId: string) => {
  await connectDB();
  const opportunities = await TrainingOpportunity.find({
    organizationId,
    active: { $ne: false },
  })
    .select("title")
    .lean();

  const opportunityIds = opportunities.map((row) => row._id);
  const applications = await StudentTrainingApplication.find({
    opportunityId: { $in: opportunityIds },
    status: {
      $in: [
        "institution_review",
        "interview_requested",
        "accepted",
        "rejected",
        "awaiting_school_approval",
        "completed",
      ],
    },
  })
    .sort({ submittedAt: -1 })
    .lean();

  const oppMap = new Map(opportunities.map((row) => [String(row._id), row]));

  return applications.map((row) => ({
    id: String(row._id),
    status: row.status,
    institutionStatus: row.institutionStatus || "institution_pending",
    opportunityTitle: oppMap.get(String(row.opportunityId))?.title || "",
    opportunityId: String(row.opportunityId),
    studentName: row.studentSnapshot?.fullName || "",
    studentGrade: row.studentSnapshot?.grade || "",
    studentStage: row.studentSnapshot?.stage || "",
    submittedAt: row.submittedAt ? new Date(row.submittedAt).toISOString() : null,
    reviewedAt: row.reviewedAt ? new Date(row.reviewedAt).toISOString() : null,
    rejectionReason: row.rejectionReason || "",
  }));
};

export const getInstitutionDashboardCounts = async (organizationId: string) => {
  const items = await listInstitutionApplications(organizationId);
  return {
    new: items.filter(
      (row) => row.status === "institution_review" && row.institutionStatus === "institution_pending"
    ).length,
    interview: items.filter((row) => row.status === "interview_requested").length,
    accepted: items.filter((row) => row.status === "accepted").length,
    rejected: items.filter((row) => row.status === "rejected").length,
    inProgress: items.filter((row) => row.status === "accepted").length,
    completed: items.filter((row) => row.status === "completed").length,
    awaitingSchoolApproval: items.filter((row) => row.status === "awaiting_school_approval").length,
    inReview: items.filter(
      (row) =>
        row.status === "institution_review" && row.institutionStatus !== "institution_pending"
    ).length,
  };
};

export const getInstitutionApplicationDetail = async (
  applicationId: string,
  organizationId: string,
  locale: "ar" | "en" = "ar"
) => {
  await connectDB();
  const application = await StudentTrainingApplication.findById(applicationId).lean();
  if (!application) return null;

  const opportunity = await TrainingOpportunity.findById(application.opportunityId).lean();
  if (!opportunity || String(opportunity.organizationId) !== String(organizationId)) return null;

  const organization = await PartnerOrganization.findById(organizationId).select("name city sector").lean();

  const [studentProfile, requirements, interviews, assessments, evaluation, contactAccess, scorecard, documentTracker, tags, privateNotes] =
    await Promise.all([
    buildInstitutionStudentProfileSummary(
      String(application.studentId),
      application.studentSnapshot,
      locale
    ),
    listApplicationRequirements(applicationId, organizationId),
    listTrainingInterviews(applicationId, organizationId),
    listTrainingAssessments(applicationId, organizationId),
    getInstitutionEvaluationForApplication(applicationId),
    resolveInstitutionStudentContactView(applicationId, organizationId),
    buildCandidateScorecard(applicationId, organizationId, locale),
    buildDocumentTracker(applicationId, organizationId),
    listInstitutionCandidateTags(applicationId, organizationId),
    listInstitutionPrivateNotes(applicationId, organizationId),
  ]);

  return {
    id: String(application._id),
    status: application.status,
    institutionStatus: application.institutionStatus || "institution_pending",
    opportunityTitle: opportunity.title || "",
    opportunityId: String(application.opportunityId),
    organization: organization
      ? { id: organizationId, name: organization.name, city: organization.city || "", sector: organization.sector || "" }
      : null,
    submittedAt: application.submittedAt ? new Date(application.submittedAt).toISOString() : null,
    reviewedAt: application.reviewedAt ? new Date(application.reviewedAt).toISOString() : null,
    rejectionReason: application.rejectionReason || "",
    timeline: (application.timeline || []).map((event) => ({
      at: event.at ? new Date(event.at).toISOString() : null,
      action: event.action,
      note: event.note || "",
      actorName: event.actorName || "",
    })),
    studentProfile,
    requirements: requirements.ok ? requirements.items : [],
    interviews: interviews.ok ? interviews.items : [],
    assessments: assessments.ok ? assessments.items : [],
    evaluation,
    contactAccess,
    scorecard,
    documentTracker,
    tags: tags.ok ? tags.items : [],
    privateNotes: privateNotes.ok ? privateNotes.items : [],
  };
};

export const resolveInstitutionOrganizationForUser = async (userId: string) => {
  const { resolveInstitutionOrganizationForUser: resolve } = await import(
    "@/lib/partnerships/institution-organization-resolver"
  );
  return resolve(userId);
};
