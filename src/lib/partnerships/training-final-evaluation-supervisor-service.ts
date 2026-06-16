import "server-only";
import mongoose from "mongoose";
import type { NextRequest } from "next/server";
import connectDB from "@/lib/mongodb";
import { actorFromUser, logAuditEvent } from "@/lib/audit-log-service";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import TrainingFinalInstitutionEvaluation from "@/models/TrainingFinalInstitutionEvaluation";
import TrainingFinalStudentEvaluation from "@/models/TrainingFinalStudentEvaluation";
import TrainingOpportunity from "@/models/TrainingOpportunity";
import PartnerOrganization from "@/models/PartnerOrganization";
import type { IUser } from "@/models/User";
import {
  FINAL_EVALUATION_AUDIT_ACTIONS,
  FINAL_EVALUATION_TIMELINE_ACTIONS,
  validateFinalEvaluationTransition,
} from "@/lib/partnerships/training-final-evaluation-constants";
import { appendTimelineEvent } from "@/lib/partnerships/partnerships-application-workflow";
import { emitTrainingFinalEvaluationCareerEvent } from "@/lib/partnerships/training-final-evaluation-career-hook";
import { emitTrainingOutcomeOnFinalApproval } from "@/lib/partnerships/training-outcome-hook";

export const maybeRequestFinalEvaluationReview = async (applicationId: string): Promise<void> => {
  await connectDB();
  const [studentEval, institutionEval, application] = await Promise.all([
    TrainingFinalStudentEvaluation.findOne({ applicationId }).lean(),
    TrainingFinalInstitutionEvaluation.findOne({ applicationId }).lean(),
    StudentTrainingApplication.findById(applicationId),
  ]);

  if (!studentEval || !institutionEval || !application) return;
  if (application.status !== "completed" && application.status !== "final_evaluation_rejected") return;

  const transition = validateFinalEvaluationTransition(application.status, "awaiting_final_evaluation_review");
  if (!transition.ok) return;

  const now = new Date();
  const fromStatus = application.status;
  application.status = "awaiting_final_evaluation_review";
  application.timeline = appendTimelineEvent(application.timeline, {
    at: now,
    action: FINAL_EVALUATION_TIMELINE_ACTIONS.reviewRequested,
    fromStatus,
    toStatus: "awaiting_final_evaluation_review",
  });
  await application.save();
};

export type SupervisorFinalEvaluationAction = "approve" | "reject" | "request_resubmission";

export const reviewFinalEvaluation = async (input: {
  applicationId: string;
  action: SupervisorFinalEvaluationAction;
  notes?: string;
  actor: IUser & { _id: mongoose.Types.ObjectId };
  request?: NextRequest;
}): Promise<{ ok: true } | { ok: false; error: string; code: string }> => {
  await connectDB();
  const application = await StudentTrainingApplication.findById(input.applicationId);
  if (!application) return { ok: false, error: "Application not found", code: "not_found" };

  if (application.status !== "awaiting_final_evaluation_review") {
    return { ok: false, error: "Application is not awaiting final evaluation review", code: "invalid_status" };
  }

  const [studentEval, institutionEval] = await Promise.all([
    TrainingFinalStudentEvaluation.findOne({ applicationId: input.applicationId }),
    TrainingFinalInstitutionEvaluation.findOne({ applicationId: input.applicationId }),
  ]);

  if (!studentEval || !institutionEval) {
    return { ok: false, error: "Both evaluations must be submitted", code: "incomplete" };
  }

  const now = new Date();
  const actorName = String(input.actor.fullNameAr || input.actor.fullName || input.actor.email || "").trim();
  const notes = String(input.notes || "").trim().slice(0, 4000);

  if (input.action === "approve") {
    const transition = validateFinalEvaluationTransition(application.status, "final_evaluation_approved");
    if (!transition.ok) return { ok: false, error: transition.reason, code: "invalid_transition" };

    const fromStatus = application.status;
    application.status = "final_evaluation_approved";
    application.timeline = appendTimelineEvent(application.timeline, {
      at: now,
      action: FINAL_EVALUATION_TIMELINE_ACTIONS.approved,
      fromStatus,
      toStatus: "final_evaluation_approved",
      actorId: String(input.actor._id),
      actorName,
      note: notes || undefined,
    });
    await application.save();

    institutionEval.supervisorReviewStatus = "approved";
    institutionEval.supervisorReviewNotes = notes || undefined;
    institutionEval.supervisorReviewedAt = now;
    institutionEval.supervisorReviewedBy = input.actor._id;
    await institutionEval.save();

    await logAuditEvent({
      actionType: FINAL_EVALUATION_AUDIT_ACTIONS.approved,
      entityType: "StudentTrainingApplication",
      entityId: String(application._id),
      descriptionAr: "اعتماد التقييم النهائي للتدريب",
      actor: actorFromUser(input.actor),
      request: input.request,
      outcome: "success",
      metadata: { applicationId: input.applicationId, notes },
    });

    await emitTrainingFinalEvaluationCareerEvent(String(application.studentId), input.applicationId);
    await emitTrainingOutcomeOnFinalApproval({
      applicationId: input.applicationId,
      approvedBy: input.actor,
      request: input.request,
    });
    return { ok: true };
  }

  if (input.action === "reject") {
    const transition = validateFinalEvaluationTransition(application.status, "final_evaluation_rejected");
    if (!transition.ok) return { ok: false, error: transition.reason, code: "invalid_transition" };

    const fromStatus = application.status;
    application.status = "final_evaluation_rejected";
    application.timeline = appendTimelineEvent(application.timeline, {
      at: now,
      action: FINAL_EVALUATION_TIMELINE_ACTIONS.rejected,
      fromStatus,
      toStatus: "final_evaluation_rejected",
      actorId: String(input.actor._id),
      actorName,
      note: notes || undefined,
    });
    await application.save();

    institutionEval.supervisorReviewStatus = "rejected";
    institutionEval.supervisorReviewNotes = notes || undefined;
    institutionEval.supervisorReviewedAt = now;
    institutionEval.supervisorReviewedBy = input.actor._id;
    institutionEval.locked = false;
    studentEval.locked = false;
    await institutionEval.save();
    await studentEval.save();

    await logAuditEvent({
      actionType: FINAL_EVALUATION_AUDIT_ACTIONS.rejected,
      entityType: "StudentTrainingApplication",
      entityId: String(application._id),
      descriptionAr: "رفض التقييم النهائي للتدريب",
      actor: actorFromUser(input.actor),
      request: input.request,
      outcome: "success",
      metadata: { applicationId: input.applicationId, notes },
    });
    return { ok: true };
  }

  // request_resubmission
  const fromStatus = application.status;
  application.status = "final_evaluation_rejected";
  application.timeline = appendTimelineEvent(application.timeline, {
    at: now,
    action: FINAL_EVALUATION_TIMELINE_ACTIONS.rejected,
    fromStatus,
    toStatus: "final_evaluation_rejected",
    actorId: String(input.actor._id),
    actorName,
    note: notes || "resubmission_requested",
  });
  await application.save();

  institutionEval.supervisorReviewStatus = "resubmission_requested";
  institutionEval.supervisorReviewNotes = notes || undefined;
  institutionEval.supervisorReviewedAt = now;
  institutionEval.supervisorReviewedBy = input.actor._id;
  institutionEval.locked = false;
  studentEval.locked = false;
  await institutionEval.save();
  await studentEval.save();

  await logAuditEvent({
    actionType: FINAL_EVALUATION_AUDIT_ACTIONS.updated,
    entityType: "StudentTrainingApplication",
    entityId: String(application._id),
    descriptionAr: "طلب إعادة تقديم التقييم النهائي",
    actor: actorFromUser(input.actor),
    request: input.request,
    outcome: "success",
    metadata: { applicationId: input.applicationId, notes, action: "request_resubmission" },
  });

  return { ok: true };
};

export const listFinalEvaluationsForSupervisor = async () => {
  await connectDB();
  const applications = await StudentTrainingApplication.find({
    status: { $in: ["awaiting_final_evaluation_review", "final_evaluation_approved", "final_evaluation_rejected"] },
  })
    .sort({ updatedAt: -1 })
    .limit(200)
    .lean();

  const appIds = applications.map((a) => a._id);
  const [studentEvals, institutionEvals] = await Promise.all([
    TrainingFinalStudentEvaluation.find({ applicationId: { $in: appIds } }).lean(),
    TrainingFinalInstitutionEvaluation.find({ applicationId: { $in: appIds } }).lean(),
  ]);

  const studentMap = new Map(studentEvals.map((r) => [String(r.applicationId), r]));
  const institutionMap = new Map(institutionEvals.map((r) => [String(r.applicationId), r]));

  const opportunityIds = [...new Set(applications.map((a) => String(a.opportunityId)))];
  const opportunities = await TrainingOpportunity.find({ _id: { $in: opportunityIds } })
    .select("title organizationId")
    .lean();
  const oppMap = new Map(opportunities.map((o) => [String(o._id), o]));

  const orgIds = [...new Set(opportunities.map((o) => String(o.organizationId)))];
  const orgs = await PartnerOrganization.find({ _id: { $in: orgIds } }).select("name").lean();
  const orgMap = new Map(orgs.map((o) => [String(o._id), o]));

  return applications.map((app) => {
    const opp = oppMap.get(String(app.opportunityId));
    const org = opp ? orgMap.get(String(opp.organizationId)) : undefined;
    const instEval = institutionMap.get(String(app._id));
    return {
      applicationId: String(app._id),
      status: app.status,
      studentName: app.studentSnapshot?.fullName || "",
      opportunityTitle: opp?.title || "",
      organizationName: org?.name || "",
      submittedAt: instEval?.submittedAt ? new Date(instEval.submittedAt).toISOString() : null,
      aiVerificationScore: instEval?.aiVerification?.verificationScore ?? null,
      aiClassification: instEval?.aiVerification?.classification ?? null,
      hasStudentEvaluation: studentMap.has(String(app._id)),
      hasInstitutionEvaluation: institutionMap.has(String(app._id)),
      supervisorReviewStatus: instEval?.supervisorReviewStatus || "pending",
    };
  });
};

export const getFinalEvaluationDetailForSupervisor = async (applicationId: string) => {
  await connectDB();
  const application = await StudentTrainingApplication.findById(applicationId).lean();
  if (!application) return null;

  const [studentEval, institutionEval, opportunity] = await Promise.all([
    TrainingFinalStudentEvaluation.findOne({ applicationId }).lean(),
    TrainingFinalInstitutionEvaluation.findOne({ applicationId }).lean(),
    TrainingOpportunity.findById(application.opportunityId).lean(),
  ]);

  const organization = opportunity
    ? await PartnerOrganization.findById(opportunity.organizationId).select("name").lean()
    : null;

  return {
    application: {
      id: String(application._id),
      status: application.status,
      studentName: application.studentSnapshot?.fullName || "",
      timeline: application.timeline || [],
    },
    opportunityTitle: opportunity?.title || "",
    organizationName: organization?.name || "",
    studentEvaluation: studentEval,
    institutionEvaluation: institutionEval,
  };
};
