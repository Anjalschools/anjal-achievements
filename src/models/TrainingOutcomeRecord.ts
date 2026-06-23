import mongoose, { Document, Model, Schema, Types } from "mongoose";
import {
  TRAINING_OUTCOME_LEVELS,
  TRAINING_OUTCOME_RECOGNITION_TYPES,
  type TrainingOutcomeLevel,
  type TrainingOutcomeRecognitionType,
} from "@/lib/partnerships/training-outcome-constants";

export interface ITrainingOutcomeRecord extends Document {
  applicationId: Types.ObjectId;
  studentId: Types.ObjectId;
  institutionId: Types.ObjectId;
  opportunityId: Types.ObjectId;
  academicYearId?: Types.ObjectId;
  academicYearLabel?: string;
  trainingHours: number;
  trainingStartDate?: Date;
  trainingEndDate?: Date;
  studentSatisfactionScore: number;
  institutionEvaluationScore: number;
  employabilityScore: number;
  readinessScore: number;
  recommendedForFutureTraining: boolean;
  recommendedForEmployment: boolean;
  outcomeLevel: TrainingOutcomeLevel;
  recognitions: TrainingOutcomeRecognitionType[];
  approvedAt: Date;
  approvedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TrainingOutcomeRecordSchema = new Schema<ITrainingOutcomeRecord>(
  {
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: "StudentTrainingApplication",
      required: true,
      unique: true,
    },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    institutionId: { type: Schema.Types.ObjectId, ref: "PartnerOrganization", required: true },
    opportunityId: { type: Schema.Types.ObjectId, ref: "TrainingOpportunity", required: true, index: true },
    academicYearId: { type: Schema.Types.ObjectId, ref: "AcademicYear", sparse: true, index: true },
    academicYearLabel: { type: String, trim: true, maxlength: 80, index: true },
    trainingHours: { type: Number, required: true, min: 0, default: 0 },
    trainingStartDate: { type: Date },
    trainingEndDate: { type: Date },
    studentSatisfactionScore: { type: Number, required: true, min: 0, max: 10 },
    institutionEvaluationScore: { type: Number, required: true, min: 0, max: 100 },
    employabilityScore: { type: Number, required: true, min: 0, max: 100, index: true },
    readinessScore: { type: Number, required: true, min: 0, max: 100 },
    recommendedForFutureTraining: { type: Boolean, required: true, default: false },
    recommendedForEmployment: { type: Boolean, required: true, default: false, index: true },
    outcomeLevel: { type: String, enum: TRAINING_OUTCOME_LEVELS, required: true, index: true },
    recognitions: { type: [String], enum: TRAINING_OUTCOME_RECOGNITION_TYPES, default: [] },
    approvedAt: { type: Date, required: true, index: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

TrainingOutcomeRecordSchema.index({ studentId: 1, approvedAt: -1 });
TrainingOutcomeRecordSchema.index({ institutionId: 1, approvedAt: -1 });

const TrainingOutcomeRecord: Model<ITrainingOutcomeRecord> =
  mongoose.models.TrainingOutcomeRecord ||
  mongoose.model<ITrainingOutcomeRecord>("TrainingOutcomeRecord", TrainingOutcomeRecordSchema);

export default TrainingOutcomeRecord;
