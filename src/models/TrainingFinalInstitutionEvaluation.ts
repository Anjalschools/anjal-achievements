import mongoose, { Document, Model, Schema, Types } from "mongoose";
import {
  FINAL_EVALUATION_MODE_VALUES,
  type FinalEvaluationAiVerification,
  type FinalEvaluationMode,
} from "@/lib/partnerships/training-final-evaluation-constants";

export interface ITrainingFinalInstitutionEvaluation extends Document {
  applicationId: Types.ObjectId;
  institutionId: Types.ObjectId;
  studentId: Types.ObjectId;
  opportunityId: Types.ObjectId;
  trainingStartDate?: Date;
  trainingEndDate?: Date;
  trainingHours?: number;
  assignedTasks?: string;
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
  passedTraining: boolean;
  recommendFutureTraining: boolean;
  recommendEmployment: boolean;
  strengths?: string;
  improvementAreas?: string;
  finalRecommendation?: string;
  recommendationReason?: string;
  supervisorName: string;
  supervisorTitle?: string;
  supervisorPhone?: string;
  supervisorEmail?: string;
  supervisorSignature?: string;
  evaluationMode: FinalEvaluationMode;
  reportFileKey?: string;
  reportStorageProvider?: "r2" | "cloudinary";
  generatedReportFileKey?: string;
  generatedReportStorageProvider?: "r2";
  aiVerification?: FinalEvaluationAiVerification;
  supervisorReviewStatus?: "pending" | "approved" | "rejected" | "resubmission_requested";
  supervisorReviewNotes?: string;
  supervisorReviewedAt?: Date;
  supervisorReviewedBy?: Types.ObjectId;
  submittedAt: Date;
  locked: boolean;
  academicYearId?: Types.ObjectId;
  academicYearLabel?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TrainingFinalInstitutionEvaluationSchema = new Schema<ITrainingFinalInstitutionEvaluation>(
  {
    applicationId: { type: Schema.Types.ObjectId, ref: "StudentTrainingApplication", required: true, unique: true, index: true },
    institutionId: { type: Schema.Types.ObjectId, ref: "PartnerOrganization", required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    opportunityId: { type: Schema.Types.ObjectId, ref: "TrainingOpportunity", required: true, index: true },
    trainingStartDate: { type: Date },
    trainingEndDate: { type: Date },
    trainingHours: { type: Number, min: 0 },
    assignedTasks: { type: String, trim: true, maxlength: 12000 },
    attendanceScore: { type: Number, required: true, min: 1, max: 5 },
    punctualityScore: { type: Number, required: true, min: 1, max: 5 },
    instructionComplianceScore: { type: Number, required: true, min: 1, max: 5 },
    workEthicsScore: { type: Number, required: true, min: 1, max: 5 },
    responsibilityScore: { type: Number, required: true, min: 1, max: 5 },
    professionalismScore: { type: Number, required: true, min: 1, max: 5 },
    communicationScore: { type: Number, required: true, min: 1, max: 5 },
    teamworkScore: { type: Number, required: true, min: 1, max: 5 },
    initiativeScore: { type: Number, required: true, min: 1, max: 5 },
    learningSpeedScore: { type: Number, required: true, min: 1, max: 5 },
    taskExecutionScore: { type: Number, required: true, min: 1, max: 5 },
    workQualityScore: { type: Number, required: true, min: 1, max: 5 },
    safetyComplianceScore: { type: Number, required: true, min: 1, max: 5 },
    passedTraining: { type: Boolean, required: true },
    recommendFutureTraining: { type: Boolean, required: true },
    recommendEmployment: { type: Boolean, required: true },
    strengths: { type: String, trim: true, maxlength: 6000 },
    improvementAreas: { type: String, trim: true, maxlength: 6000 },
    finalRecommendation: { type: String, trim: true, maxlength: 4000 },
    recommendationReason: { type: String, trim: true, maxlength: 2000 },
    supervisorName: { type: String, required: true, trim: true, maxlength: 200 },
    supervisorTitle: { type: String, trim: true, maxlength: 200 },
    supervisorPhone: { type: String, trim: true, maxlength: 40 },
    supervisorEmail: { type: String, trim: true, maxlength: 200 },
    supervisorSignature: { type: String, trim: true, maxlength: 4000 },
    evaluationMode: { type: String, enum: FINAL_EVALUATION_MODE_VALUES, required: true },
    reportFileKey: { type: String, trim: true, maxlength: 2000 },
    reportStorageProvider: { type: String, enum: ["r2", "cloudinary"], sparse: true },
    generatedReportFileKey: { type: String, trim: true, maxlength: 2000 },
    generatedReportStorageProvider: { type: String, enum: ["r2"], sparse: true },
    aiVerification: { type: Schema.Types.Mixed },
    supervisorReviewStatus: {
      type: String,
      enum: ["pending", "approved", "rejected", "resubmission_requested"],
      default: "pending",
      index: true,
    },
    supervisorReviewNotes: { type: String, trim: true, maxlength: 4000 },
    supervisorReviewedAt: { type: Date },
    supervisorReviewedBy: { type: Schema.Types.ObjectId, ref: "User", sparse: true },
    submittedAt: { type: Date, required: true, index: true },
    locked: { type: Boolean, default: true, index: true },
    academicYearId: { type: Schema.Types.ObjectId, ref: "AcademicYear", sparse: true, index: true },
    academicYearLabel: { type: String, trim: true, maxlength: 80 },
  },
  { timestamps: true }
);

TrainingFinalInstitutionEvaluationSchema.index({ institutionId: 1, submittedAt: -1 });
TrainingFinalInstitutionEvaluationSchema.index({ supervisorReviewStatus: 1, submittedAt: -1 });

const TrainingFinalInstitutionEvaluation: Model<ITrainingFinalInstitutionEvaluation> =
  mongoose.models.TrainingFinalInstitutionEvaluation ||
  mongoose.model<ITrainingFinalInstitutionEvaluation>(
    "TrainingFinalInstitutionEvaluation",
    TrainingFinalInstitutionEvaluationSchema
  );

export default TrainingFinalInstitutionEvaluation;
