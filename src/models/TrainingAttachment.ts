import mongoose, { Document, Model, Schema, Types } from "mongoose";
import { TRAINING_ATTACHMENT_TYPES } from "@/lib/partnerships/training-completion-constants";

export interface ITrainingAttachment extends Document {
  recordId?: Types.ObjectId;
  applicationId?: Types.ObjectId;
  requirementId?: Types.ObjectId;
  type: (typeof TRAINING_ATTACHMENT_TYPES)[number];
  fileName: string;
  storageKey: string;
  mimeType?: string;
  fileSize?: number;
  storageProvider?: "r2" | "cloudinary";
  contentFingerprint?: string;
  uploadedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TrainingAttachmentSchema = new Schema<ITrainingAttachment>(
  {
    recordId: { type: Schema.Types.ObjectId, ref: "TrainingCompletionRecord", sparse: true, index: true },
    applicationId: { type: Schema.Types.ObjectId, ref: "StudentTrainingApplication", sparse: true, index: true },
    requirementId: { type: Schema.Types.ObjectId, ref: "ApplicationRequirement", sparse: true, index: true },
    type: { type: String, enum: TRAINING_ATTACHMENT_TYPES, required: true, index: true },
    fileName: { type: String, required: true, trim: true, maxlength: 300 },
    storageKey: { type: String, required: true, trim: true, maxlength: 2000 },
    mimeType: { type: String, trim: true, maxlength: 120 },
    fileSize: { type: Number, min: 0 },
    storageProvider: { type: String, enum: ["r2", "cloudinary"], sparse: true },
    contentFingerprint: { type: String, trim: true, index: true, sparse: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: true }
);

TrainingAttachmentSchema.index({ recordId: 1, createdAt: 1 });

const TrainingAttachment: Model<ITrainingAttachment> =
  mongoose.models.TrainingAttachment ||
  mongoose.model<ITrainingAttachment>("TrainingAttachment", TrainingAttachmentSchema);

export default TrainingAttachment;
