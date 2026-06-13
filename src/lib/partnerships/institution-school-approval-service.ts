import mongoose from "mongoose";
import type { NextRequest } from "next/server";
import connectDB from "@/lib/mongodb";
import InstitutionReview from "@/models/InstitutionReview";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import TrainingCompletionRecord from "@/models/TrainingCompletionRecord";
import TrainingOpportunity from "@/models/TrainingOpportunity";
import User from "@/models/User";
import Notification from "@/models/Notification";
import { logAuditEvent } from "@/lib/audit-log-service";
import { appendTimelineEvent } from "@/lib/partnerships/partnerships-application-workflow";
import { reviewTrainingCompletionReport } from "@/lib/partnerships/training-completion-service";
import type { InstitutionFinalRecommendation } from "@/lib/partnerships/institution-experience-constants";

const recommendationToRating = (value?: InstitutionFinalRecommendation | string): number => {
  const map: Record<string, number> = {
    excellent: 5,
    very_good: 4,
    good: 4,
    acceptable: 3,
    not_recommended: 2,
    strongly_recommend: 5,
    recommend: 4,
    neutral: 3,
    not_recommend: 2,
  };
  return map[String(value || "")] || 3;
};

const notifyPartnershipSupervisors = async (input: {
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}) => {
  const supervisors = await User.find({
    role: { $in: ["partnershipSupervisor", "admin"] },
    status: "active",
  })
    .select("_id")
    .lean();

  await Promise.all(
    supervisors.map((row) =>
      Notification.create({
        userId: row._id,
        type: "partnership_message",
        title: input.title.trim().slice(0, 300),
        message: input.message.trim().slice(0, 4000),
        read: false,
        metadata: input.metadata,
      })
    )
  );
};

export const approveInstitutionEvaluationForSchool = async (input: {
  applicationId: string;
  reviewerId: mongoose.Types.ObjectId;
  actorName: string;
  note?: string;
  request?: NextRequest;
}) => {
  await connectDB();
  const application = await StudentTrainingApplication.findById(input.applicationId);
  if (!application) throw new Error("Application not found");
  if (application.status !== "awaiting_school_approval") {
    throw new Error("Application is not awaiting school approval");
  }

  const evaluation = await InstitutionReview.findOne({
    applicationId: application._id,
    reviewKind: "completion_evaluation",
  })
    .sort({ reviewedAt: -1 })
    .lean();
  if (!evaluation) throw new Error("Institution completion evaluation not found");

  const opportunity = await TrainingOpportunity.findById(application.opportunityId).lean();
  if (!opportunity) throw new Error("Opportunity not found");

  let record = await TrainingCompletionRecord.findOne({ applicationId: application._id });
  if (!record) {
    record = await TrainingCompletionRecord.create({
      applicationId: application._id,
      studentId: application.studentId,
      organizationId: opportunity.organizationId,
      academicYear: application.academicYear,
      status: "under_review",
      organizationName: "",
    });
  }

  const strengths = String(evaluation.strengths || "").trim();
  const improvements = String(evaluation.improvementAreas || "").trim();
  const notes = [strengths, improvements, String(evaluation.institutionNotes || "").trim()]
    .filter(Boolean)
    .join("\n");

  record.attendanceCommitment = evaluation.attendance || evaluation.commitment || 3;
  record.professionalEthics = evaluation.discipline || evaluation.commitment || 3;
  record.safetyCompliance = evaluation.teamwork || 3;
  record.overallRecommendation = recommendationToRating(evaluation.finalRecommendation);
  record.institutionNotes = notes || undefined;
  record.status = "under_review";
  record.submittedAt = record.submittedAt || new Date();
  await record.save();

  const bundle = await reviewTrainingCompletionReport({
    recordId: String(record._id),
    action: "approve",
    reviewerId: input.reviewerId,
    actorName: input.actorName,
    note: input.note,
  });

  await logAuditEvent({
    actionType: "institution_school_approval_granted",
    entityType: "StudentTrainingApplication",
    entityId: String(application._id),
    entityTitle: application.studentSnapshot?.fullName,
    descriptionAr: "اعتماد المدرسة للتقرير النهائي من المؤسسة",
    actor: {
      id: input.reviewerId,
      name: input.actorName,
      role: "partnershipSupervisor",
    },
    request: input.request,
    outcome: "success",
    metadata: {
      applicationId: String(application._id),
      evaluationId: String(evaluation._id),
      completionRecordId: String(record._id),
    },
  });

  return bundle;
};

export const rejectInstitutionEvaluationForSchool = async (input: {
  applicationId: string;
  reviewerId: mongoose.Types.ObjectId;
  actorName: string;
  note: string;
  request?: NextRequest;
}) => {
  await connectDB();
  const application = await StudentTrainingApplication.findById(input.applicationId);
  if (!application) throw new Error("Application not found");
  if (application.status !== "awaiting_school_approval") {
    throw new Error("Application is not awaiting school approval");
  }

  const fromStatus = application.status;
  application.status = "accepted";
  application.timeline = appendTimelineEvent(application.timeline, {
    at: new Date(),
    action: "institution_school_approval_rejected",
    fromStatus,
    toStatus: "accepted",
    actorId: String(input.reviewerId),
    actorName: input.actorName,
    note: input.note,
  });
  await application.save();

  await logAuditEvent({
    actionType: "institution_school_approval_rejected",
    entityType: "StudentTrainingApplication",
    entityId: String(application._id),
    entityTitle: application.studentSnapshot?.fullName,
    descriptionAr: "رفض اعتماد المدرسة للتقرير النهائي من المؤسسة",
    actor: {
      id: input.reviewerId,
      name: input.actorName,
      role: "partnershipSupervisor",
    },
    request: input.request,
    outcome: "success",
    metadata: { note: input.note },
  });

  return { ok: true as const };
};

export const notifySchoolOnInstitutionEvaluationSubmitted = async (input: {
  applicationId: string;
  studentName: string;
  organizationName: string;
}) => {
  await notifyPartnershipSupervisors({
    title: "تقرير نهائي بانتظار اعتماد المدرسة",
    message: `أكملت مؤسسة ${input.organizationName} التقرير النهائي للطالب ${input.studentName}.`,
    metadata: {
      applicationId: input.applicationId,
      kind: "awaiting_school_approval",
    },
  });
};

export const notifySchoolOnInstitutionDecision = async (input: {
  applicationId: string;
  studentName: string;
  organizationName: string;
  decision: "accepted" | "rejected";
}) => {
  await notifyPartnershipSupervisors({
    title: input.decision === "accepted" ? "قبول مؤسسة — تدريب صيفي" : "رفض مؤسسة — تدريب صيفي",
    message: `${input.organizationName}: ${input.studentName}`,
    metadata: {
      applicationId: input.applicationId,
      decision: input.decision,
      kind: "institution_decision",
    },
  });
};
