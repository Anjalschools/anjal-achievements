import mongoose, { Document, Model, Schema, Types } from "mongoose";
import type { FinalEvaluationAttachmentRef } from "@/lib/partnerships/training-final-evaluation-constants";

export interface ITrainingFinalStudentEvaluation extends Document {
  applicationId: Types.ObjectId;
  studentId: Types.ObjectId;
  institutionId: Types.ObjectId;
  opportunityId: Types.ObjectId;
  trainingStartDate?: Date;
  trainingEndDate?: Date;
  trainingHours?: number;
  traineeCount?: number;
  receivedAllowance?: boolean;
  allowanceAmount?: number;
  objectivesClarityScore: number;
  supervisionQualityScore: number;
  practicalBenefitScore: number;
  relevanceScore: number;
  workEnvironmentScore: number;
  skillsLearned?: string;
  majorTasksCompleted?: string;
  mostValuableExperience?: string;
  improvementSuggestions?: string;
  recommendToStudents: boolean;
  overallSatisfactionScore: number;
  imageAttachments: FinalEvaluationAttachmentRef[];
  videoUrls: string[];
  documentAttachments: FinalEvaluationAttachmentRef[];
  submittedAt: Date;
  locked: boolean;
  academicYearId?: Types.ObjectId;
  academicYearLabel?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AttachmentRefSchema = new Schema(
  {
    attachmentId: { type: String, trim: true, maxlength: 40 },
    fileName: { type: String, required: true, trim: true, maxlength: 300 },
    storageKey: { type: String, required: true, trim: true, maxlength: 2000 },
    mimeType: { type: String, trim: true, maxlength: 120 },
    storageProvider: { type: String, enum: ["r2", "cloudinary"], sparse: true },
    label: { type: String, trim: true, maxlength: 40 },
    caption: { type: String, trim: true, maxlength: 500 },
  },
  { _id: false }
);

const TrainingFinalStudentEvaluationSchema = new Schema<ITrainingFinalStudentEvaluation>(
  {
    applicationId: { type: Schema.Types.ObjectId, ref: "StudentTrainingApplication", required: true, unique: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    institutionId: { type: Schema.Types.ObjectId, ref: "PartnerOrganization", required: true, index: true },
    opportunityId: { type: Schema.Types.ObjectId, ref: "TrainingOpportunity", required: true, index: true },
    trainingStartDate: { type: Date },
    trainingEndDate: { type: Date },
    trainingHours: { type: Number, min: 0 },
    traineeCount: { type: Number, min: 0 },
    receivedAllowance: { type: Boolean, default: false },
    allowanceAmount: { type: Number, min: 0 },
    objectivesClarityScore: { type: Number, required: true, min: 1, max: 5 },
    supervisionQualityScore: { type: Number, required: true, min: 1, max: 5 },
    practicalBenefitScore: { type: Number, required: true, min: 1, max: 5 },
    relevanceScore: { type: Number, required: true, min: 1, max: 5 },
    workEnvironmentScore: { type: Number, required: true, min: 1, max: 5 },
    skillsLearned: { type: String, trim: true, maxlength: 8000 },
    majorTasksCompleted: { type: String, trim: true, maxlength: 8000 },
    mostValuableExperience: { type: String, trim: true, maxlength: 4000 },
    improvementSuggestions: { type: String, trim: true, maxlength: 4000 },
    recommendToStudents: { type: Boolean, required: true },
    overallSatisfactionScore: { type: Number, required: true, min: 1, max: 10 },
    imageAttachments: { type: [AttachmentRefSchema], default: [] },
    videoUrls: { type: [String], default: [] },
    documentAttachments: { type: [AttachmentRefSchema], default: [] },
    submittedAt: { type: Date, required: true, index: true },
    locked: { type: Boolean, default: true, index: true },
    academicYearId: { type: Schema.Types.ObjectId, ref: "AcademicYear", sparse: true, index: true },
    academicYearLabel: { type: String, trim: true, maxlength: 80 },
  },
  { timestamps: true }
);

TrainingFinalStudentEvaluationSchema.index({ institutionId: 1, submittedAt: -1 });
TrainingFinalStudentEvaluationSchema.index({ academicYearLabel: 1, submittedAt: -1 });

const TrainingFinalStudentEvaluation: Model<ITrainingFinalStudentEvaluation> =
  mongoose.models.TrainingFinalStudentEvaluation ||
  mongoose.model<ITrainingFinalStudentEvaluation>(
    "TrainingFinalStudentEvaluation",
    TrainingFinalStudentEvaluationSchema
  );

export default TrainingFinalStudentEvaluation;
