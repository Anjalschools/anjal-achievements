import "server-only";
import mongoose from "mongoose";
import type { NextRequest } from "next/server";
import connectDB from "@/lib/mongodb";
import { actorFromUser, logAuditEvent } from "@/lib/audit-log-service";
import type { IUser } from "@/models/User";
import TrainingOutcomeRecord from "@/models/TrainingOutcomeRecord";
import InstitutionTalentRecommendation from "@/models/InstitutionTalentRecommendation";
import TrainingFinalInstitutionEvaluation from "@/models/TrainingFinalInstitutionEvaluation";
import TrainingFinalStudentEvaluation from "@/models/TrainingFinalStudentEvaluation";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import {
  TRAINING_OUTCOME_AUDIT_ACTIONS,
  TRAINING_OUTCOME_TIMELINE_ACTIONS,
  type TalentRecommendationLevel,
} from "@/lib/partnerships/training-outcome-constants";
import {
  computeEmployabilityScore,
  computeInstitutionEvaluationScore,
} from "@/lib/partnerships/training-employability-scoring";
import {
  computeSingleTrainingReadinessContribution,
  computeTrainingReadinessScore,
  deriveOutcomeLevel,
} from "@/lib/partnerships/training-readiness-scoring";
import { deriveTrainingRecognitions } from "@/lib/partnerships/training-outcome-recognition";
import { appendTimelineEvent } from "@/lib/partnerships/partnerships-application-workflow";

const institutionDimensionScores = (row: {
  attendanceScore: number;
  punctualityScore: number;
  instructionComplianceScore: number;
  workEthicsScore: number;
  responsibilityScore: number;
  professionalismScore: number;
  communicationScore: number;
  teamworkScore: number;
  initiativeScore: number;
  learningSpeedScore: number;
  taskExecutionScore: number;
  workQualityScore: number;
  safetyComplianceScore: number;
}) => [
  row.attendanceScore,
  row.punctualityScore,
  row.instructionComplianceScore,
  row.workEthicsScore,
  row.responsibilityScore,
  row.professionalismScore,
  row.communicationScore,
  row.teamworkScore,
  row.initiativeScore,
  row.learningSpeedScore,
  row.taskExecutionScore,
  row.workQualityScore,
  row.safetyComplianceScore,
];

const avg = (values: number[]) =>
  values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : 0;

const resolveTalentRecommendationLevel = (employabilityScore: number): TalentRecommendationLevel => {
  if (employabilityScore >= 85) return "strong";
  if (employabilityScore >= 70) return "moderate";
  return "conditional";
};

export const createTrainingOutcomeFromApproval = async (input: {
  applicationId: string;
  approvedBy: IUser & { _id: mongoose.Types.ObjectId };
  request?: NextRequest;
}): Promise<{ ok: true; outcomeId: string } | { ok: false; error: string }> => {
  if (!mongoose.Types.ObjectId.isValid(input.applicationId)) {
    return { ok: false, error: "Invalid application id" };
  }

  await connectDB();

  const existing = await TrainingOutcomeRecord.findOne({ applicationId: input.applicationId }).lean();
  if (existing) return { ok: true, outcomeId: String(existing._id) };

  const [application, studentEval, institutionEval] = await Promise.all([
    StudentTrainingApplication.findById(input.applicationId),
    TrainingFinalStudentEvaluation.findOne({ applicationId: input.applicationId }).lean(),
    TrainingFinalInstitutionEvaluation.findOne({ applicationId: input.applicationId }).lean(),
  ]);

  if (!application || !studentEval || !institutionEval) {
    return { ok: false, error: "Missing evaluation data" };
  }

  if (application.status !== "final_evaluation_approved") {
    return { ok: false, error: "Application not in approved final evaluation status" };
  }

  const allInstitutionScores = institutionDimensionScores(institutionEval);
  const institutionEvaluationScore = computeInstitutionEvaluationScore(allInstitutionScores);
  const institutionEvalAvg1to5 = avg(allInstitutionScores);

  const employabilityScore = computeEmployabilityScore({
    institutionEvaluationAverage: institutionEvalAvg1to5,
    attendanceScore: institutionEval.attendanceScore,
    professionalismScore: institutionEval.professionalismScore,
    communicationScore: institutionEval.communicationScore,
    teamworkScore: institutionEval.teamworkScore,
    initiativeScore: institutionEval.initiativeScore,
    workQualityScore: institutionEval.workQualityScore,
    safetyComplianceScore: institutionEval.safetyComplianceScore,
  });

  const priorOutcomes = await TrainingOutcomeRecord.find({ studentId: application.studentId }).lean();
  const completedCount = priorOutcomes.length + 1;
  const totalHours =
    priorOutcomes.reduce((s, r) => s + (r.trainingHours || 0), 0) +
    (institutionEval.trainingHours || studentEval.trainingHours || 0);

  const avgInstEval =
    priorOutcomes.length > 0
      ? avg([...priorOutcomes.map((r) => r.institutionEvaluationScore), institutionEvaluationScore])
      : institutionEvaluationScore;

  const avgSatisfaction =
    priorOutcomes.length > 0
      ? avg([...priorOutcomes.map((r) => r.studentSatisfactionScore), studentEval.overallSatisfactionScore])
      : studentEval.overallSatisfactionScore;

  const futureRecCount =
    priorOutcomes.filter((r) => r.recommendedForFutureTraining).length +
    (institutionEval.recommendFutureTraining ? 1 : 0);
  const employmentRecCount =
    priorOutcomes.filter((r) => r.recommendedForEmployment).length +
    (institutionEval.recommendEmployment ? 1 : 0);
  const passedCount = priorOutcomes.filter((r) => r.outcomeLevel !== "needs_improvement").length +
    (institutionEval.passedTraining ? 1 : 0);

  const readinessScore = computeTrainingReadinessScore({
    completedTrainingCount: completedCount,
    totalTrainingHours: totalHours,
    avgInstitutionEvaluationScore: avgInstEval,
    avgStudentSatisfaction: avgSatisfaction,
    institutionRecommendationRate: Math.round((futureRecCount / completedCount) * 100),
    employmentRecommendationRate: Math.round((employmentRecCount / completedCount) * 100),
    passedTrainingRate: Math.round((passedCount / completedCount) * 100),
  });

  const singleReadiness = computeSingleTrainingReadinessContribution({
    institutionEvaluationScore,
    studentSatisfactionScore: studentEval.overallSatisfactionScore,
    trainingHours: institutionEval.trainingHours || studentEval.trainingHours || 0,
    recommendedForFutureTraining: institutionEval.recommendFutureTraining,
    recommendedForEmployment: institutionEval.recommendEmployment,
    passedTraining: institutionEval.passedTraining,
  });

  const outcomeLevel = deriveOutcomeLevel({
    employabilityScore,
    readinessScore: singleReadiness,
    passedTraining: institutionEval.passedTraining,
  });

  const recognitions = deriveTrainingRecognitions({
    employabilityScore,
    institutionEvaluationScore,
    professionalismScore: institutionEval.professionalismScore,
    safetyComplianceScore: institutionEval.safetyComplianceScore,
    passedTraining: institutionEval.passedTraining,
    recommendedForEmployment: institutionEval.recommendEmployment,
    outcomeLevel,
  });

  const now = new Date();
  const outcome = await TrainingOutcomeRecord.create({
    applicationId: application._id,
    studentId: application.studentId,
    institutionId: institutionEval.institutionId,
    opportunityId: application.opportunityId,
    academicYearId: studentEval.academicYearId || institutionEval.academicYearId,
    academicYearLabel: studentEval.academicYearLabel || institutionEval.academicYearLabel,
    trainingHours: institutionEval.trainingHours || studentEval.trainingHours || 0,
    trainingStartDate: institutionEval.trainingStartDate || studentEval.trainingStartDate,
    trainingEndDate: institutionEval.trainingEndDate || studentEval.trainingEndDate,
    studentSatisfactionScore: studentEval.overallSatisfactionScore,
    institutionEvaluationScore,
    employabilityScore,
    readinessScore,
    recommendedForFutureTraining: institutionEval.recommendFutureTraining,
    recommendedForEmployment: institutionEval.recommendEmployment,
    outcomeLevel,
    recognitions,
    approvedAt: now,
    approvedBy: input.approvedBy._id,
  });

  application.timeline = appendTimelineEvent(application.timeline, {
    at: now,
    action: TRAINING_OUTCOME_TIMELINE_ACTIONS.outcomeCreated,
    note: `outcomeLevel=${outcomeLevel}`,
  });
  application.timeline = appendTimelineEvent(application.timeline, {
    at: now,
    action: TRAINING_OUTCOME_TIMELINE_ACTIONS.employabilityGenerated,
    note: `score=${employabilityScore}`,
  });
  application.timeline = appendTimelineEvent(application.timeline, {
    at: now,
    action: TRAINING_OUTCOME_TIMELINE_ACTIONS.readinessCalculated,
    note: `score=${readinessScore}`,
  });
  await application.save();

  await logAuditEvent({
    actionType: TRAINING_OUTCOME_AUDIT_ACTIONS.recordCreated,
    entityType: "TrainingOutcomeRecord",
    entityId: String(outcome._id),
    descriptionAr: "إنشاء سجل نتيجة التدريب",
    actor: actorFromUser(input.approvedBy),
    request: input.request,
    outcome: "success",
    metadata: { applicationId: input.applicationId, employabilityScore, readinessScore, outcomeLevel },
  });

  await logAuditEvent({
    actionType: TRAINING_OUTCOME_AUDIT_ACTIONS.employabilityGenerated,
    entityType: "TrainingOutcomeRecord",
    entityId: String(outcome._id),
    descriptionAr: "توليد درجة الجاهزية للتوظيف",
    actor: actorFromUser(input.approvedBy),
    request: input.request,
    outcome: "success",
    metadata: { employabilityScore },
  });

  if (institutionEval.recommendEmployment) {
    const recommendationLevel = resolveTalentRecommendationLevel(employabilityScore);
    const supervisorComment =
      institutionEval.finalRecommendation?.trim() ||
      institutionEval.strengths?.trim().slice(0, 4000) ||
      undefined;

    await InstitutionTalentRecommendation.create({
      studentId: application.studentId,
      institutionId: institutionEval.institutionId,
      applicationId: application._id,
      outcomeRecordId: outcome._id,
      recommendationDate: now,
      recommendationLevel,
      supervisorComment,
    });

    application.timeline = appendTimelineEvent(application.timeline, {
      at: now,
      action: TRAINING_OUTCOME_TIMELINE_ACTIONS.recommendationCreated,
      note: `level=${recommendationLevel}`,
    });
    await application.save();

    await logAuditEvent({
      actionType: TRAINING_OUTCOME_AUDIT_ACTIONS.recommendationGenerated,
      entityType: "InstitutionTalentRecommendation",
      entityId: String(application._id),
      descriptionAr: "توصية مؤسسة بالتوظيف",
      actor: actorFromUser(input.approvedBy),
      request: input.request,
      outcome: "success",
      metadata: { recommendationLevel, studentId: String(application.studentId) },
    });
  }

  if (process.env.AI_DEBUG === "1") {
    console.info("[training-outcome]", {
      applicationId: input.applicationId,
      employabilityScore,
      readinessScore,
      outcomeLevel,
      recognitions,
    });
  }

  return { ok: true, outcomeId: String(outcome._id) };
};
