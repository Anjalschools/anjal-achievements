import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type AlumniVerificationLevel =
  | "basic"
  | "academic"
  | "career"
  | "institution"
  | "global";

export type AlumniVerificationDocType =
  | "certificate"
  | "student_id"
  | "university_email"
  | "linkedin"
  | "employment_letter"
  | "other";

export type AlumniVerificationRequestStatus = "pending" | "approved" | "rejected";

export interface IAlumniVerificationAttachment {
  type: AlumniVerificationDocType;
  url: string;
  publicId?: string;
  label?: string;
  uploadedAt?: Date;
}

export interface IAlumniVerificationRequest extends Document {
  userId: Types.ObjectId;
  requestedLevel: AlumniVerificationLevel;
  status: AlumniVerificationRequestStatus;
  attachments: IAlumniVerificationAttachment[];
  reviewerNotes?: string;
  reviewedById?: Types.ObjectId;
  reviewedAt?: Date;
  /** 0–1 heuristic from rules / future AI OCR */
  aiValidationScore?: number;
  aiNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AttachmentSchema = new Schema<IAlumniVerificationAttachment>(
  {
    type: {
      type: String,
      enum: ["certificate", "student_id", "university_email", "linkedin", "employment_letter", "other"],
      required: true,
    },
    url: { type: String, required: true, trim: true, maxlength: 2000 },
    publicId: { type: String, trim: true, maxlength: 500 },
    label: { type: String, trim: true, maxlength: 200 },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const AlumniVerificationRequestSchema = new Schema<IAlumniVerificationRequest>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    requestedLevel: {
      type: String,
      enum: ["basic", "academic", "career", "institution", "global"],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    attachments: { type: [AttachmentSchema], default: [] },
    reviewerNotes: { type: String, trim: true, maxlength: 2000 },
    reviewedById: { type: Schema.Types.ObjectId, ref: "User", sparse: true },
    reviewedAt: { type: Date },
    aiValidationScore: { type: Number, min: 0, max: 1, sparse: true },
    aiNotes: { type: String, trim: true, maxlength: 2000 },
  },
  { timestamps: true }
);

AlumniVerificationRequestSchema.index({ userId: 1, status: 1, createdAt: -1 });

const AlumniVerificationRequest: Model<IAlumniVerificationRequest> =
  mongoose.models.AlumniVerificationRequest ||
  mongoose.model<IAlumniVerificationRequest>("AlumniVerificationRequest", AlumniVerificationRequestSchema);

export default AlumniVerificationRequest;
