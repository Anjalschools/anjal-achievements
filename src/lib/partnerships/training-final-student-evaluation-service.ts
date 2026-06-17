import "server-only";
import mongoose from "mongoose";
import type { NextRequest } from "next/server";
import connectDB from "@/lib/mongodb";
import { actorFromUser, logAuditEvent } from "@/lib/audit-log-service";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import TrainingAttachment from "@/models/TrainingAttachment";
import TrainingFinalInstitutionEvaluation from "@/models/TrainingFinalInstitutionEvaluation";
import TrainingFinalStudentEvaluation from "@/models/TrainingFinalStudentEvaluation";
import type { IUser } from "@/models/User";
import { applyAcademicYearCreateFields } from "@/lib/academic-years/academic-year-integration";
import { isAllowedTrainingVideoUrl } from "@/lib/partnerships/training-completion-constants";
import { resolveFinalEvaluationContext } from "@/lib/partnerships/training-final-evaluation-access";
import {
  FINAL_EVALUATION_AUDIT_ACTIONS,
  FINAL_EVALUATION_TIMELINE_ACTIONS,
  isScore1to10,
  isScore1to5,
  STUDENT_FINAL_EVALUATION_EDITABLE_STATUSES,
  type FinalEvaluationAttachmentRef,
} from "@/lib/partnerships/training-final-evaluation-constants";
import { appendTimelineEvent } from "@/lib/partnerships/partnerships-application-workflow";
import { maybeRequestFinalEvaluationReview } from "@/lib/partnerships/training-final-evaluation-supervisor-service";

export type SubmitStudentFinalEvaluationInput = {
  applicationId: string;
  student: IUser & { _id: mongoose.Types.ObjectId };
  payload: Record<string, unknown>;
  request?: NextRequest;
};

const parseAttachments = (value: unknown): FinalEvaluationAttachmentRef[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const storageKey = String(r.storageKey || "").trim();
      const fileName = String(r.fileName || "").trim();
      if (!storageKey || !fileName) return null;
      return {
        attachmentId: r.attachmentId ? String(r.attachmentId) : undefined,
        fileName,
        storageKey,
        mimeType: r.mimeType ? String(r.mimeType) : undefined,
        storageProvider: r.storageProvider === "cloudinary" ? "cloudinary" : "r2",
        label: r.label ? String(r.label).trim().slice(0, 40) : undefined,
        caption: r.caption ? String(r.caption).trim().slice(0, 500) : undefined,
      } as FinalEvaluationAttachmentRef;
    })
    .filter((row): row is FinalEvaluationAttachmentRef => row !== null);
};

const parseVideoUrls = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => String(v || "").trim())
    .filter((url) => url && isAllowedTrainingVideoUrl(url));
};

export const getStudentFinalEvaluation = async (applicationId: string, studentId: string) => {
  await connectDB();
  const row = await TrainingFinalStudentEvaluation.findOne({ applicationId, studentId }).lean();
  return row;
};

export const submitStudentFinalEvaluation = async (
  input: SubmitStudentFinalEvaluationInput
): Promise<{ ok: true; id: string } | { ok: false; error: string; code: string }> => {
  const ctx = await resolveFinalEvaluationContext(input.applicationId);
  if (!ctx || String(ctx.application.studentId) !== String(input.student._id)) {
    return { ok: false, error: "Application not found", code: "not_found" };
  }

  const status = String(ctx.application.status || "");
  if (!STUDENT_FINAL_EVALUATION_EDITABLE_STATUSES.has(status) && status !== "awaiting_final_evaluation_review") {
    const institutionEval = await TrainingFinalInstitutionEvaluation.findOne({
      applicationId: input.applicationId,
    }).lean();
    if (!institutionEval && status !== "completed") {
      return { ok: false, error: "Final evaluation not available yet", code: "not_eligible" };
    }
  }

  const existing = await TrainingFinalStudentEvaluation.findOne({ applicationId: input.applicationId });
  if (existing?.locked && status !== "final_evaluation_rejected") {
    return { ok: false, error: "Evaluation is locked", code: "locked" };
  }

  const p = input.payload;
  if (
    !isScore1to5(p.objectivesClarityScore) ||
    !isScore1to5(p.supervisionQualityScore) ||
    !isScore1to5(p.practicalBenefitScore) ||
    !isScore1to5(p.relevanceScore) ||
    !isScore1to5(p.workEnvironmentScore) ||
    !isScore1to10(p.overallSatisfactionScore)
  ) {
    return { ok: false, error: "Invalid scores", code: "invalid_scores" };
  }

  const now = new Date();
  const actorName = String(input.student.fullNameAr || input.student.fullName || input.student.email || "").trim();
  const yearFields: { academicYearId?: mongoose.Types.ObjectId; academicYearLabel?: string } = {};
  try {
    await applyAcademicYearCreateFields({
      academicYear: ctx.application.academicYear,
      ...yearFields,
    });
  } catch {
    yearFields.academicYearLabel = ctx.application.academicYearLabel || ctx.application.academicYear;
  }

  const imageAttachments = parseAttachments(p.imageAttachments);
  if (imageAttachments.length > 8) {
    return { ok: false, error: "Maximum 8 training images allowed", code: "too_many_images" };
  }

  const doc = {
    applicationId: ctx.application._id,
    studentId: input.student._id,
    institutionId: ctx.opportunity!.organizationId,
    opportunityId: ctx.application.opportunityId,
    trainingStartDate: p.trainingStartDate ? new Date(String(p.trainingStartDate)) : ctx.opportunity?.trainingStart,
    trainingEndDate: p.trainingEndDate ? new Date(String(p.trainingEndDate)) : ctx.opportunity?.trainingEnd,
    trainingHours: p.trainingHours !== undefined ? Number(p.trainingHours) : undefined,
    traineeCount: p.traineeCount !== undefined ? Number(p.traineeCount) : undefined,
    receivedAllowance: p.receivedAllowance === true,
    allowanceAmount: p.allowanceAmount !== undefined ? Number(p.allowanceAmount) : undefined,
    objectivesClarityScore: Number(p.objectivesClarityScore),
    supervisionQualityScore: Number(p.supervisionQualityScore),
    practicalBenefitScore: Number(p.practicalBenefitScore),
    relevanceScore: Number(p.relevanceScore),
    workEnvironmentScore: Number(p.workEnvironmentScore),
    skillsLearned: String(p.skillsLearned || "").trim().slice(0, 8000) || undefined,
    majorTasksCompleted: String(p.majorTasksCompleted || "").trim().slice(0, 8000) || undefined,
    mostValuableExperience: String(p.mostValuableExperience || "").trim().slice(0, 4000) || undefined,
    improvementSuggestions: String(p.improvementSuggestions || "").trim().slice(0, 4000) || undefined,
    recommendToStudents: p.recommendToStudents === true,
    overallSatisfactionScore: Number(p.overallSatisfactionScore),
    imageAttachments,
    videoUrls: parseVideoUrls(p.videoUrls),
    documentAttachments: parseAttachments(p.documentAttachments),
    submittedAt: now,
    locked: true,
    academicYearId: yearFields.academicYearId,
    academicYearLabel: yearFields.academicYearLabel,
  };

  let savedId: string;
  if (existing) {
    Object.assign(existing, doc);
    await existing.save();
    savedId = String(existing._id);
  } else {
    const created = await TrainingFinalStudentEvaluation.create(doc);
    savedId = String(created._id);
  }

  for (const att of [...doc.imageAttachments, ...doc.documentAttachments]) {
    await TrainingAttachment.create({
      applicationId: ctx.application._id,
      type: att.mimeType?.startsWith("image/") ? "image" : "document",
      fileName: att.fileName,
      storageKey: att.storageKey,
      mimeType: att.mimeType,
      storageProvider: att.storageProvider || "r2",
      uploadedBy: input.student._id,
    });
  }

  const application = await StudentTrainingApplication.findById(input.applicationId);
  if (application) {
    application.timeline = appendTimelineEvent(application.timeline, {
      at: now,
      action: FINAL_EVALUATION_TIMELINE_ACTIONS.studentSubmitted,
      actorId: String(input.student._id),
      actorName,
    });
    await application.save();
  }

  await logAuditEvent({
    actionType: existing ? FINAL_EVALUATION_AUDIT_ACTIONS.updated : FINAL_EVALUATION_AUDIT_ACTIONS.created,
    entityType: "TrainingFinalStudentEvaluation",
    entityId: savedId,
    descriptionAr: "تقييم الطالب النهائي للتدريب",
    actor: actorFromUser(input.student),
    request: input.request,
    outcome: "success",
    metadata: { applicationId: input.applicationId, kind: "student" },
  });

  await maybeRequestFinalEvaluationReview(input.applicationId);

  return { ok: true, id: savedId };
};
