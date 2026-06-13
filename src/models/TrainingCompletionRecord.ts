import mongoose, { Document, Model, Schema, Types } from "mongoose";
import { TRAINING_COMPLETION_STATUSES } from "@/lib/partnerships/training-completion-constants";

export interface ITrainingCompletionRecord extends Document {
  applicationId: Types.ObjectId;
  studentId: Types.ObjectId;
  organizationId: Types.ObjectId;
  academicYear: string;
  status: (typeof TRAINING_COMPLETION_STATUSES)[number];
  organizationName?: string;
  supervisorName?: string;
  supervisorPhone?: string;
  trainingStartDate?: Date;
  trainingEndDate?: Date;
  volunteerHours?: number;
  hasAllowance?: boolean;
  studentBenefitRating?: number;
  numberOfTrainees?: number;
  assignedTasks?: string;
  studentReflection?: string;
  attendanceCommitment?: number;
  professionalEthics?: number;
  safetyCompliance?: number;
  overallRecommendation?: number;
  institutionNotes?: string;
  videoUrl?: string;
  reviewNotes?: string;
  reviewedAt?: Date;
  reviewedBy?: Types.ObjectId;
  submittedAt?: Date;
  achievementId?: Types.ObjectId;
  automationCompletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TrainingCompletionRecordSchema = new Schema<ITrainingCompletionRecord>(
  {
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: "StudentTrainingApplication",
      required: true,
      unique: true,
      index: true,
    },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "PartnerOrganization", required: true, index: true },
    academicYear: { type: String, required: true, trim: true, maxlength: 80, index: true },
    status: {
      type: String,
      enum: TRAINING_COMPLETION_STATUSES,
      required: true,
      default: "pending",
      index: true,
    },
    organizationName: { type: String, trim: true, maxlength: 220 },
    supervisorName: { type: String, trim: true, maxlength: 200 },
    supervisorPhone: { type: String, trim: true, maxlength: 40 },
    trainingStartDate: { type: Date },
    trainingEndDate: { type: Date },
    volunteerHours: { type: Number, min: 0, max: 10000 },
    hasAllowance: { type: Boolean },
    studentBenefitRating: { type: Number, min: 1, max: 5 },
    numberOfTrainees: { type: Number, min: 0, max: 5000 },
    assignedTasks: { type: String, trim: true, maxlength: 8000 },
    studentReflection: { type: String, trim: true, maxlength: 8000 },
    attendanceCommitment: { type: Number, min: 1, max: 5 },
    professionalEthics: { type: Number, min: 1, max: 5 },
    safetyCompliance: { type: Number, min: 1, max: 5 },
    overallRecommendation: { type: Number, min: 1, max: 5 },
    institutionNotes: { type: String, trim: true, maxlength: 4000 },
    videoUrl: { type: String, trim: true, maxlength: 2000 },
    reviewNotes: { type: String, trim: true, maxlength: 4000 },
    reviewedAt: { type: Date },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    submittedAt: { type: Date, index: true },
    achievementId: { type: Schema.Types.ObjectId, ref: "Achievement", sparse: true, index: true },
    automationCompletedAt: { type: Date },
  },
  { timestamps: true }
);

TrainingCompletionRecordSchema.index({ status: 1, submittedAt: -1 });
TrainingCompletionRecordSchema.index({ studentId: 1, academicYear: 1 });

const TrainingCompletionRecord: Model<ITrainingCompletionRecord> =
  mongoose.models.TrainingCompletionRecord ||
  mongoose.model<ITrainingCompletionRecord>("TrainingCompletionRecord", TrainingCompletionRecordSchema);

export default TrainingCompletionRecord;
