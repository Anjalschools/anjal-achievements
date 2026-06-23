import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type PartnershipThreadKind = "application" | "general" | "opportunity";

export interface IPartnershipThread extends Document {
  studentId: Types.ObjectId;
  applicationId?: Types.ObjectId;
  opportunityId?: Types.ObjectId;
  threadKind: PartnershipThreadKind;
  inquiryType?: string;
  subject: string;
  lastMessagePreview?: string;
  lastMessageAt?: Date;
  studentUnreadCount: number;
  supervisorUnreadCount: number;
  institutionUnreadCount?: number;
  participantSupervisorIds: Types.ObjectId[];
  participantInstitutionUserIds?: Types.ObjectId[];
  archived?: boolean;
  archivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PartnershipThreadSchema = new Schema<IPartnershipThread>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    applicationId: { type: Schema.Types.ObjectId, ref: "StudentTrainingApplication" },
    opportunityId: { type: Schema.Types.ObjectId, ref: "TrainingOpportunity", sparse: true, index: true },
    threadKind: {
      type: String,
      enum: ["application", "general", "opportunity"],
      default: "application",
      index: true,
    },
    inquiryType: { type: String, trim: true, maxlength: 60, sparse: true },
    subject: { type: String, required: true, trim: true, maxlength: 220 },
    lastMessagePreview: { type: String, trim: true, maxlength: 300 },
    lastMessageAt: { type: Date, index: true },
    studentUnreadCount: { type: Number, default: 0, min: 0 },
    supervisorUnreadCount: { type: Number, default: 0, min: 0 },
    institutionUnreadCount: { type: Number, default: 0, min: 0 },
    participantSupervisorIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    participantInstitutionUserIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    archived: { type: Boolean, default: false, index: true },
    archivedAt: { type: Date },
  },
  { timestamps: true }
);

PartnershipThreadSchema.index({ studentId: 1, lastMessageAt: -1 });
PartnershipThreadSchema.index({ applicationId: 1 }, { unique: true, sparse: true });
PartnershipThreadSchema.index(
  { studentId: 1, threadKind: 1 },
  { unique: true, partialFilterExpression: { threadKind: "general" } }
);
PartnershipThreadSchema.index(
  { studentId: 1, opportunityId: 1, threadKind: 1 },
  { unique: true, partialFilterExpression: { threadKind: "opportunity" } }
);

const PartnershipThread: Model<IPartnershipThread> =
  mongoose.models.PartnershipThread ||
  mongoose.model<IPartnershipThread>("PartnershipThread", PartnershipThreadSchema);

export default PartnershipThread;
