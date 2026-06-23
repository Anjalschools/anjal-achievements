import mongoose, { Document, Model, Schema, Types } from "mongoose";
import {
  TRAINING_ASSESSMENT_STATUSES,
  TRAINING_ASSESSMENT_TYPES,
} from "@/lib/partnerships/institution-experience-constants";

export interface ITrainingAssessment extends Document {
  applicationId: Types.ObjectId;
  organizationId: Types.ObjectId;
  type: (typeof TRAINING_ASSESSMENT_TYPES)[number];
  title: string;
  description?: string;
  externalUrl?: string;
  dueDate?: Date;
  status: (typeof TRAINING_ASSESSMENT_STATUSES)[number];
  submissionAttachmentId?: Types.ObjectId;
  submissionNotes?: string;
  submittedAt?: Date;
  submittedBy?: Types.ObjectId;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TrainingAssessmentSchema = new Schema<ITrainingAssessment>(
  {
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: "StudentTrainingApplication",
      required: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "PartnerOrganization",
      required: true,
      index: true,
    },
    type: { type: String, enum: TRAINING_ASSESSMENT_TYPES, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 220 },
    description: { type: String, trim: true, maxlength: 4000 },
    externalUrl: { type: String, trim: true, maxlength: 2000 },
    dueDate: { type: Date, index: true },
    status: {
      type: String,
      enum: TRAINING_ASSESSMENT_STATUSES,
      default: "pending",
      index: true,
    },
    submissionAttachmentId: { type: Schema.Types.ObjectId, ref: "TrainingAttachment", sparse: true },
    submissionNotes: { type: String, trim: true, maxlength: 4000 },
    submittedAt: { type: Date },
    submittedBy: { type: Schema.Types.ObjectId, ref: "User" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

TrainingAssessmentSchema.index({ applicationId: 1, createdAt: 1 });

const TrainingAssessment: Model<ITrainingAssessment> =
  mongoose.models.TrainingAssessment ||
  mongoose.model<ITrainingAssessment>("TrainingAssessment", TrainingAssessmentSchema);

export default TrainingAssessment;
