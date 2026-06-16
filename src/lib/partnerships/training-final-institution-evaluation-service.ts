import "server-only";
import mongoose from "mongoose";
import type { NextRequest } from "next/server";
import connectDB from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit-log-service";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import TrainingFinalInstitutionEvaluation from "@/models/TrainingFinalInstitutionEvaluation";
import TrainingFinalStudentEvaluation from "@/models/TrainingFinalStudentEvaluation";
import { applyAcademicYearCreateFields } from "@/lib/academic-years/academic-year-integration";
import { uploadEvidenceBufferToR2 } from "@/lib/partnerships/evidence-r2-upload";
import { assertInstitutionApplicationWritable } from "@/lib/partnerships/institution-scope";
import { resolveFinalEvaluationContext } from "@/lib/partnerships/training-final-evaluation-access";
import {
  FINAL_EVALUATION_AUDIT_ACTIONS,
  FINAL_EVALUATION_MODE_VALUES,
  FINAL_EVALUATION_TIMELINE_ACTIONS,
  isScore1to5,
  type FinalEvaluationMode,
} from "@/lib/partnerships/training-final-evaluation-constants";
import { generateTrainingFinalReportPdfBuffer } from "@/lib/partnerships/training-final-report-pdf-generator";
import type { TrainingFinalReportTemplateContext } from "@/lib/partnerships/training-final-report-template-constants";
import { runTrainingFinalReportAiReview } from "@/lib/partnerships/training-final-report-ai-review-service";
import { appendTimelineEvent } from "@/lib/partnerships/partnerships-application-workflow";
import { maybeRequestFinalEvaluationReview } from "@/lib/partnerships/training-final-evaluation-supervisor-service";

const INSTITUTION_ELIGIBLE_STATUSES = new Set([
  "accepted",
  "awaiting_school_approval",
  "completed",
  "final_evaluation_rejected",
]);

const formatDate = (value?: Date | string | null) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("ar-SA");
  } catch {
    return "—";
  }
};

export type SubmitInstitutionFinalEvaluationInput = {
  applicationId: string;
  organizationId: string;
  evaluationMode: FinalEvaluationMode;
  payload: Record<string, unknown>;
  actor: { id: string; name: string };
  request?: NextRequest;
};

const isValidMode = (mode: string): mode is FinalEvaluationMode =>
  FINAL_EVALUATION_MODE_VALUES.includes(mode as FinalEvaluationMode);

const validateScores = (p: Record<string, unknown>): boolean => {
  const keys = [
    "attendanceScore",
    "punctualityScore",
    "instructionComplianceScore",
    "workEthicsScore",
    "responsibilityScore",
    "professionalismScore",
    "communicationScore",
    "teamworkScore",
    "initiativeScore",
    "learningSpeedScore",
    "taskExecutionScore",
    "workQualityScore",
    "safetyComplianceScore",
  ];
  return keys.every((k) => isScore1to5(p[k]));
};

export const getInstitutionFinalEvaluation = async (applicationId: string, organizationId: string) => {
  const ctx = await resolveFinalEvaluationContext(applicationId);
  if (!ctx || String(ctx.opportunity?.organizationId) !== String(organizationId)) return null;
  return TrainingFinalInstitutionEvaluation.findOne({ applicationId }).lean();
};

export const generateInstitutionFinalReportTemplate = async (
  applicationId: string,
  organizationId: string,
  draft?: Record<string, unknown>
): Promise<{ ok: true; storageKey: string } | { ok: false; error: string; code: string }> => {
  const ctx = await resolveFinalEvaluationContext(applicationId);
  if (!ctx || String(ctx.opportunity?.organizationId) !== String(organizationId)) {
    return { ok: false, error: "Not found", code: "not_found" };
  }

  const p = draft || {};
  const templateContext: TrainingFinalReportTemplateContext = {
    studentName: ctx.application.studentSnapshot?.fullName || "",
    school: ctx.application.studentSnapshot?.school || "—",
    institutionName: ctx.organization?.name || "",
    opportunityTitle: ctx.opportunity?.title || "",
    trainingStartDate: formatDate(
      p.trainingStartDate ? String(p.trainingStartDate) : ctx.opportunity?.trainingStart
    ),
    trainingEndDate: formatDate(
      p.trainingEndDate ? String(p.trainingEndDate) : ctx.opportunity?.trainingEnd
    ),
    trainingHours: String(p.trainingHours || "—"),
    assignedTasks: String(p.assignedTasks || ""),
    scores: {
      attendance: Number(p.attendanceScore || 3),
      punctuality: Number(p.punctualityScore || 3),
      instructionCompliance: Number(p.instructionComplianceScore || 3),
      workEthics: Number(p.workEthicsScore || 3),
      responsibility: Number(p.responsibilityScore || 3),
      professionalism: Number(p.professionalismScore || 3),
      communication: Number(p.communicationScore || 3),
      teamwork: Number(p.teamworkScore || 3),
      initiative: Number(p.initiativeScore || 3),
      learningSpeed: Number(p.learningSpeedScore || 3),
      taskExecution: Number(p.taskExecutionScore || 3),
      workQuality: Number(p.workQualityScore || 3),
      safetyCompliance: Number(p.safetyComplianceScore || 3),
    },
    passedTraining: p.passedTraining === true,
    recommendFutureTraining: p.recommendFutureTraining === true,
    recommendEmployment: p.recommendEmployment === true,
    strengths: String(p.strengths || ""),
    improvementAreas: String(p.improvementAreas || ""),
    finalRecommendation: String(p.finalRecommendation || ""),
    supervisorName: String(p.supervisorName || ""),
    supervisorTitle: String(p.supervisorTitle || ""),
    generatedAt: new Date().toLocaleDateString("ar-SA"),
  };

  const buffer = await generateTrainingFinalReportPdfBuffer(templateContext);
  const uploaded = await uploadEvidenceBufferToR2({
    buffer,
    fileName: `training-final-report-${applicationId}.pdf`,
    mimeType: "application/pdf",
  });

  return { ok: true, storageKey: uploaded.storageKey };
};

export const submitInstitutionFinalEvaluation = async (
  input: SubmitInstitutionFinalEvaluationInput
): Promise<{ ok: true; id: string } | { ok: false; error: string; code: string }> => {
  if (!isValidMode(input.evaluationMode)) {
    return { ok: false, error: "Invalid evaluation mode", code: "invalid_mode" };
  }

  const access = await assertInstitutionApplicationWritable(input.applicationId, input.organizationId);
  if (!access.ok) return { ok: false, error: access.error, code: access.code };

  if (!INSTITUTION_ELIGIBLE_STATUSES.has(access.scope.status)) {
    return { ok: false, error: "Application not eligible for final evaluation", code: "invalid_status" };
  }

  const existing = await TrainingFinalInstitutionEvaluation.findOne({ applicationId: input.applicationId });
  if (existing?.locked && existing.supervisorReviewStatus !== "resubmission_requested") {
    return { ok: false, error: "Evaluation is locked", code: "locked" };
  }

  const p = input.payload;
  if (!validateScores(p)) return { ok: false, error: "Invalid scores", code: "invalid_scores" };
  if (!String(p.supervisorName || "").trim()) {
    return { ok: false, error: "Supervisor name is required", code: "supervisor_required" };
  }

  if (input.evaluationMode === "uploaded_document" && !String(p.reportFileKey || "").trim()) {
    return { ok: false, error: "Signed report file is required", code: "report_required" };
  }

  const ctx = await resolveFinalEvaluationContext(input.applicationId);
  if (!ctx) return { ok: false, error: "Application not found", code: "not_found" };

  const now = new Date();
  const yearFields: { academicYearId?: mongoose.Types.ObjectId; academicYearLabel?: string } = {};
  try {
    await applyAcademicYearCreateFields({ academicYear: ctx.application.academicYear, ...yearFields });
  } catch {
    yearFields.academicYearLabel = ctx.application.academicYearLabel || ctx.application.academicYear;
  }

  let generatedReportFileKey: string | undefined;
  if (input.evaluationMode === "portal") {
    const template = await generateInstitutionFinalReportTemplate(input.applicationId, input.organizationId, p);
    if (template.ok) generatedReportFileKey = template.storageKey;
  }

  const reportFileKey = String(p.reportFileKey || generatedReportFileKey || "").trim() || undefined;

  let aiVerification;
  if (reportFileKey) {
    aiVerification = await runTrainingFinalReportAiReview({
      reportFileKey,
      studentName: ctx.application.studentSnapshot?.fullName || "",
      institutionName: ctx.organization?.name || "",
      trainingHours: p.trainingHours !== undefined ? Number(p.trainingHours) : undefined,
      trainingStartDate: p.trainingStartDate ? String(p.trainingStartDate) : undefined,
      trainingEndDate: p.trainingEndDate ? String(p.trainingEndDate) : undefined,
      supervisorName: String(p.supervisorName),
    });
  }

  const doc = {
    applicationId: ctx.application._id,
    institutionId: new mongoose.Types.ObjectId(input.organizationId),
    studentId: ctx.application.studentId,
    opportunityId: ctx.application.opportunityId,
    trainingStartDate: p.trainingStartDate ? new Date(String(p.trainingStartDate)) : ctx.opportunity?.trainingStart,
    trainingEndDate: p.trainingEndDate ? new Date(String(p.trainingEndDate)) : ctx.opportunity?.trainingEnd,
    trainingHours: p.trainingHours !== undefined ? Number(p.trainingHours) : undefined,
    assignedTasks: String(p.assignedTasks || "").trim().slice(0, 12000) || undefined,
    attendanceScore: Number(p.attendanceScore),
    punctualityScore: Number(p.punctualityScore),
    instructionComplianceScore: Number(p.instructionComplianceScore),
    workEthicsScore: Number(p.workEthicsScore),
    responsibilityScore: Number(p.responsibilityScore),
    professionalismScore: Number(p.professionalismScore),
    communicationScore: Number(p.communicationScore),
    teamworkScore: Number(p.teamworkScore),
    initiativeScore: Number(p.initiativeScore),
    learningSpeedScore: Number(p.learningSpeedScore),
    taskExecutionScore: Number(p.taskExecutionScore),
    workQualityScore: Number(p.workQualityScore),
    safetyComplianceScore: Number(p.safetyComplianceScore),
    passedTraining: p.passedTraining === true,
    recommendFutureTraining: p.recommendFutureTraining === true,
    recommendEmployment: p.recommendEmployment === true,
    strengths: String(p.strengths || "").trim().slice(0, 6000) || undefined,
    improvementAreas: String(p.improvementAreas || "").trim().slice(0, 6000) || undefined,
    finalRecommendation: String(p.finalRecommendation || "").trim().slice(0, 4000) || undefined,
    supervisorName: String(p.supervisorName).trim(),
    supervisorTitle: String(p.supervisorTitle || "").trim() || undefined,
    supervisorPhone: String(p.supervisorPhone || "").trim() || undefined,
    supervisorEmail: String(p.supervisorEmail || "").trim() || undefined,
    supervisorSignature: String(p.supervisorSignature || "").trim() || undefined,
    evaluationMode: input.evaluationMode,
    reportFileKey,
    reportStorageProvider: reportFileKey ? ("r2" as const) : undefined,
    generatedReportFileKey,
    generatedReportStorageProvider: generatedReportFileKey ? ("r2" as const) : undefined,
    aiVerification,
    supervisorReviewStatus: "pending" as const,
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
    const created = await TrainingFinalInstitutionEvaluation.create(doc);
    savedId = String(created._id);
  }

  const application = await StudentTrainingApplication.findById(input.applicationId);
  if (application) {
    application.timeline = appendTimelineEvent(application.timeline, {
      at: now,
      action:
        input.evaluationMode === "uploaded_document"
          ? FINAL_EVALUATION_TIMELINE_ACTIONS.institutionReportUploaded
          : FINAL_EVALUATION_TIMELINE_ACTIONS.institutionSubmitted,
      actorId: input.actor.id,
      actorName: input.actor.name,
      note: input.evaluationMode,
    });
    if (aiVerification) {
      application.timeline = appendTimelineEvent(application.timeline, {
        at: now,
        action: FINAL_EVALUATION_TIMELINE_ACTIONS.aiVerified,
        note: `${aiVerification.verificationScore}`,
      });
    }
    await application.save();
  }

  await logAuditEvent({
    actionType: existing ? FINAL_EVALUATION_AUDIT_ACTIONS.updated : FINAL_EVALUATION_AUDIT_ACTIONS.created,
    entityType: "TrainingFinalInstitutionEvaluation",
    entityId: savedId,
    descriptionAr: "تقييم المؤسسة النهائي للتدريب",
    actor: {
      id: mongoose.Types.ObjectId.isValid(input.actor.id) ? new mongoose.Types.ObjectId(input.actor.id) : undefined,
      name: input.actor.name,
      role: "trainingInstitution",
    },
    request: input.request,
    outcome: "success",
    metadata: { applicationId: input.applicationId, evaluationMode: input.evaluationMode },
  });

  await maybeRequestFinalEvaluationReview(input.applicationId);

  return { ok: true, id: savedId };
};
