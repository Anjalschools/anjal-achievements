import "server-only";
import mongoose from "mongoose";
import type { NextRequest } from "next/server";
import connectDB from "@/lib/mongodb";
import InstitutionReview from "@/models/InstitutionReview";
import PartnerOrganization from "@/models/PartnerOrganization";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import TrainingOpportunity from "@/models/TrainingOpportunity";
import { logAuditEvent, type AuditActor } from "@/lib/audit-log-service";
import {
  STUDENT_FEEDBACK_RATING_MAX,
  STUDENT_FEEDBACK_RATING_MIN,
} from "@/lib/partnerships/institution-analytics-constants";
import { recomputeOrganizationRating } from "@/lib/partnerships/institution-analytics-service";

export type StudentFeedbackInput = {
  overallRating: number;
  trainingQualityRating: number;
  supervisionRating: number;
  workEnvironmentRating: number;
  benefitRating: number;
  wouldRecommend: boolean;
  studentFeedbackNotes?: string;
};

export type StudentFeedbackSummary = {
  id: string;
  applicationId: string;
  organizationId: string;
  overallRating: number;
  trainingQualityRating: number;
  supervisionRating: number;
  workEnvironmentRating: number;
  benefitRating: number;
  wouldRecommend: boolean;
  studentFeedbackNotes: string;
  reviewedAt: string;
  updatedAt: string;
};

const clampRating = (value: unknown): number => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(STUDENT_FEEDBACK_RATING_MAX, Math.max(STUDENT_FEEDBACK_RATING_MIN, Math.round(n)));
};

const validateFeedbackInput = (input: StudentFeedbackInput): void => {
  const fields = [
    input.overallRating,
    input.trainingQualityRating,
    input.supervisionRating,
    input.workEnvironmentRating,
    input.benefitRating,
  ];
  for (const rating of fields) {
    if (rating < STUDENT_FEEDBACK_RATING_MIN || rating > STUDENT_FEEDBACK_RATING_MAX) {
      throw new Error("All ratings must be between 1 and 5");
    }
  }
};

const serializeFeedback = (row: {
  _id?: { toString(): string };
  applicationId?: { toString(): string };
  organizationId?: { toString(): string };
  overallRating?: number;
  trainingQualityRating?: number;
  supervisionRating?: number;
  workEnvironmentRating?: number;
  benefitRating?: number;
  wouldRecommend?: boolean;
  studentFeedbackNotes?: string;
  reviewedAt?: Date;
  updatedAt?: Date;
}): StudentFeedbackSummary => ({
  id: String(row._id),
  applicationId: String(row.applicationId),
  organizationId: String(row.organizationId),
  overallRating: Number(row.overallRating || 0),
  trainingQualityRating: Number(row.trainingQualityRating || 0),
  supervisionRating: Number(row.supervisionRating || 0),
  workEnvironmentRating: Number(row.workEnvironmentRating || 0),
  benefitRating: Number(row.benefitRating || 0),
  wouldRecommend: row.wouldRecommend === true,
  studentFeedbackNotes: row.studentFeedbackNotes || "",
  reviewedAt: row.reviewedAt ? new Date(row.reviewedAt).toISOString() : new Date().toISOString(),
  updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString(),
});

const resolveApplicationContext = async (applicationId: string, studentId: mongoose.Types.ObjectId) => {
  await connectDB();
  const application = await StudentTrainingApplication.findOne({
    _id: applicationId,
    studentId,
    archived: { $ne: true },
  }).lean();
  if (!application) throw new Error("Application not found");
  if (String(application.status) !== "completed") {
    throw new Error("Student feedback is only available for completed training");
  }

  const opportunity = await TrainingOpportunity.findById(application.opportunityId).lean();
  if (!opportunity) throw new Error("Opportunity not found");

  const organizationId = String(opportunity.organizationId);
  const organization = await PartnerOrganization.findById(organizationId).lean();
  if (!organization) throw new Error("Organization not found");

  return { application, organizationId, organizationName: organization.name };
};

export const getStudentFeedbackForApplication = async (
  applicationId: string,
  studentId: mongoose.Types.ObjectId
): Promise<StudentFeedbackSummary | null> => {
  await connectDB();
  const application = await StudentTrainingApplication.findOne({
    _id: applicationId,
    studentId,
    archived: { $ne: true },
  }).lean();
  if (!application) return null;

  const review = await InstitutionReview.findOne({
    applicationId,
    reviewKind: "student_feedback",
  }).lean();

  return review ? serializeFeedback(review) : null;
};

export const submitStudentFeedback = async (input: {
  applicationId: string;
  studentId: mongoose.Types.ObjectId;
  feedback: StudentFeedbackInput;
  actor: AuditActor;
  request?: NextRequest;
}): Promise<StudentFeedbackSummary> => {
  const normalized: StudentFeedbackInput = {
    overallRating: clampRating(input.feedback.overallRating),
    trainingQualityRating: clampRating(input.feedback.trainingQualityRating),
    supervisionRating: clampRating(input.feedback.supervisionRating),
    workEnvironmentRating: clampRating(input.feedback.workEnvironmentRating),
    benefitRating: clampRating(input.feedback.benefitRating),
    wouldRecommend: input.feedback.wouldRecommend === true,
    studentFeedbackNotes: String(input.feedback.studentFeedbackNotes || "").trim().slice(0, 4000),
  };
  validateFeedbackInput(normalized);

  const { organizationId, organizationName } = await resolveApplicationContext(
    input.applicationId,
    input.studentId
  );

  const existing = await InstitutionReview.findOne({
    applicationId: input.applicationId,
    reviewKind: "student_feedback",
  });

  const reviewPayload = {
    applicationId: new mongoose.Types.ObjectId(input.applicationId),
    organizationId: new mongoose.Types.ObjectId(organizationId),
    decision: "institution_student_feedback" as const,
    reviewKind: "student_feedback" as const,
    reviewedAt: new Date(),
    studentId: input.studentId,
    overallRating: normalized.overallRating,
    trainingQualityRating: normalized.trainingQualityRating,
    supervisionRating: normalized.supervisionRating,
    workEnvironmentRating: normalized.workEnvironmentRating,
    benefitRating: normalized.benefitRating,
    wouldRecommend: normalized.wouldRecommend,
    studentFeedbackNotes: normalized.studentFeedbackNotes || undefined,
  };

  let review;
  if (existing) {
    const before = {
      overallRating: existing.overallRating,
      trainingQualityRating: existing.trainingQualityRating,
      supervisionRating: existing.supervisionRating,
      workEnvironmentRating: existing.workEnvironmentRating,
      benefitRating: existing.benefitRating,
      wouldRecommend: existing.wouldRecommend,
      studentFeedbackNotes: existing.studentFeedbackNotes,
    };
    existing.set(reviewPayload);
    review = await existing.save();

    await logAuditEvent({
      actionType: "institution_student_feedback_updated",
      entityType: "InstitutionReview",
      entityId: String(review._id),
      entityTitle: organizationName,
      descriptionAr: `تم تعديل تقييم الطالب للمؤسسة: ${organizationName}`,
      actor: input.actor,
      request: input.request,
      outcome: "success",
      before,
      after: {
        overallRating: review.overallRating,
        trainingQualityRating: review.trainingQualityRating,
        supervisionRating: review.supervisionRating,
        workEnvironmentRating: review.workEnvironmentRating,
        benefitRating: review.benefitRating,
        wouldRecommend: review.wouldRecommend,
        studentFeedbackNotes: review.studentFeedbackNotes,
      },
      metadata: { applicationId: input.applicationId, organizationId },
    });
  } else {
    review = await InstitutionReview.create(reviewPayload);

    await logAuditEvent({
      actionType: "institution_student_feedback_created",
      entityType: "InstitutionReview",
      entityId: String(review._id),
      entityTitle: organizationName,
      descriptionAr: `تم إضافة تقييم الطالب للمؤسسة: ${organizationName}`,
      actor: input.actor,
      request: input.request,
      outcome: "success",
      after: {
        overallRating: review.overallRating,
        trainingQualityRating: review.trainingQualityRating,
        supervisionRating: review.supervisionRating,
        workEnvironmentRating: review.workEnvironmentRating,
        benefitRating: review.benefitRating,
        wouldRecommend: review.wouldRecommend,
      },
      metadata: { applicationId: input.applicationId, organizationId },
    });
  }

  await recomputeOrganizationRating(organizationId);

  return serializeFeedback(review.toObject());
};
