import "server-only";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import PartnerOrganization from "@/models/PartnerOrganization";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import TrainingFinalInstitutionEvaluation from "@/models/TrainingFinalInstitutionEvaluation";
import TrainingOpportunity from "@/models/TrainingOpportunity";
import InstitutionReview from "@/models/InstitutionReview";
import { STUDENT_FINAL_EVALUATION_EDITABLE_STATUSES } from "@/lib/partnerships/training-final-evaluation-constants";

export const hasInstitutionFinalReportSubmitted = async (applicationId: string): Promise<boolean> => {
  await connectDB();
  const [newEval, legacyReview] = await Promise.all([
    TrainingFinalInstitutionEvaluation.findOne({ applicationId }).select("_id").lean(),
    InstitutionReview.findOne({ applicationId, reviewKind: "completion_evaluation" }).select("_id").lean(),
  ]);
  return Boolean(newEval || legacyReview);
};

export const canStudentAccessFinalEvaluation = async (
  applicationId: string,
  studentId: string
): Promise<{ ok: boolean; reason?: string }> => {
  await connectDB();
  const application = await StudentTrainingApplication.findOne({
    _id: applicationId,
    studentId,
  }).lean();
  if (!application) return { ok: false, reason: "not_found" };

  const status = String(application.status || "");
  const institutionSubmitted = await hasInstitutionFinalReportSubmitted(applicationId);

  if (status === "completed" || institutionSubmitted || STUDENT_FINAL_EVALUATION_EDITABLE_STATUSES.has(status)) {
    return { ok: true };
  }
  return { ok: false, reason: "not_eligible" };
};

export const canStudentAccessFinalReport = async (
  applicationId: string,
  studentId: string
): Promise<boolean> => {
  await connectDB();
  const application = await StudentTrainingApplication.findOne({
    _id: applicationId,
    studentId,
  })
    .select("status")
    .lean();
  if (!application) return false;
  const status = String(application.status || "");
  return [
    "completed",
    "awaiting_final_evaluation_review",
    "final_evaluation_approved",
    "final_evaluation_rejected",
  ].includes(status);
};

export const resolveFinalEvaluationContext = async (applicationId: string) => {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(applicationId)) return null;

  const application = await StudentTrainingApplication.findById(applicationId).lean();
  if (!application) return null;

  const opportunity = await TrainingOpportunity.findById(application.opportunityId).lean();
  const organization = opportunity
    ? await PartnerOrganization.findById(opportunity.organizationId).lean()
    : null;

  return { application, opportunity, organization };
};
