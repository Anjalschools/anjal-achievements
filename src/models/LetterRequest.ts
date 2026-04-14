import mongoose, { Schema, Document, Model, Types } from "mongoose";
import type {
  LetterRequestLanguage,
  LetterRequestStatus,
  LetterRequestType,
  LetterRequestedAuthorRole,
} from "@/lib/letter-request-types";

export type {
  LetterRequestLanguage,
  LetterRequestStatus,
  LetterRequestType,
  LetterRequestedAuthorRole,
} from "@/lib/letter-request-types";

export type LetterStudentSnapshot = {
  fullName: string;
  fullNameAr?: string;
  fullNameEn?: string;
  studentId?: string;
  grade?: string;
  section?: string;
  gender?: string;
};

export type LetterStatusHistoryEntry = {
  at: Date;
  actorUserId?: Types.ObjectId;
  actorRole?: string;
  action: string;
  fromStatus?: LetterRequestStatus;
  toStatus?: LetterRequestStatus;
  note?: string;
};

export interface ILetterRequest extends Document {
  userId: Types.ObjectId;
  studentSnapshot: LetterStudentSnapshot;
  requestType: LetterRequestType;
  language: LetterRequestLanguage;
  targetOrganization: string;
  requestBody: string;
  /** Student: who should write the letter (distinct from admin final signer fields). */
  requestedWriterName?: string;
  requestedAuthorRole: LetterRequestedAuthorRole;
  requestedSpecialization?: string;
  status: LetterRequestStatus;
  aiDraftText?: string;
  finalApprovedText?: string;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  /** Opaque verification token (only set when approved). */
  verificationToken?: string;
  rejectReason?: string;
  revisionNote?: string;
  statusHistory: LetterStatusHistoryEntry[];
  /** Admin-entered signer display (optional; empty string = cleared). */
  signerNameAr?: string;
  signerNameEn?: string;
  signerTitleAr?: string;
  signerTitleEn?: string;
  signerOrganizationLabelAr?: string;
  signerOrganizationLabelEn?: string;
  createdAt: Date;
  updatedAt: Date;
}

const studentSnapshotSchema = new Schema(
  {
    fullName: { type: String, required: true },
    fullNameAr: { type: String },
    fullNameEn: { type: String },
    studentId: { type: String },
    grade: { type: String },
    section: { type: String },
    gender: { type: String },
  },
  { _id: false }
);

const statusHistorySchema = new Schema(
  {
    at: { type: Date, required: true },
    actorUserId: { type: Schema.Types.ObjectId, ref: "User" },
    actorRole: { type: String },
    action: { type: String, required: true },
    fromStatus: { type: String },
    toStatus: { type: String },
    note: { type: String },
  },
  { _id: false }
);

const letterRequestSchema = new Schema<ILetterRequest>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    studentSnapshot: { type: studentSnapshotSchema, required: true },
    requestType: {
      type: String,
      enum: ["testimonial", "recommendation"],
      required: true,
    },
    language: { type: String, enum: ["ar", "en"], required: true },
    targetOrganization: { type: String, required: true, trim: true },
    requestBody: { type: String, required: true, trim: true },
    requestedWriterName: { type: String, trim: true },
    requestedAuthorRole: {
      type: String,
      enum: ["teacher", "supervisor", "school_administration"],
      required: true,
    },
    requestedSpecialization: { type: String, trim: true },
    status: {
      type: String,
      enum: ["pending", "in_review", "approved", "rejected", "needs_revision"],
      default: "pending",
      index: true,
    },
    aiDraftText: { type: String },
    finalApprovedText: { type: String },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    verificationToken: { type: String, sparse: true, unique: true },
    rejectReason: { type: String },
    revisionNote: { type: String },
    statusHistory: { type: [statusHistorySchema], default: [] },
    signerNameAr: { type: String, trim: true },
    signerNameEn: { type: String, trim: true },
    signerTitleAr: { type: String, trim: true },
    signerTitleEn: { type: String, trim: true },
    signerOrganizationLabelAr: { type: String, trim: true },
    signerOrganizationLabelEn: { type: String, trim: true },
  },
  { timestamps: true }
);

letterRequestSchema.index({ userId: 1, createdAt: -1 });
letterRequestSchema.index({ status: 1, createdAt: -1 });

const LetterRequest: Model<ILetterRequest> =
  mongoose.models.LetterRequest || mongoose.model<ILetterRequest>("LetterRequest", letterRequestSchema);

export default LetterRequest;
