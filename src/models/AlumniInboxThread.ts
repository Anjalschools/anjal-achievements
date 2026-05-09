import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IAlumniInboxThread extends Document {
  /** Alumni participant (always present). */
  alumniId: Types.ObjectId;
  /** Participants allowed to access thread (alumni + admins who participated). */
  participantIds: Types.ObjectId[];
  subject: string;
  lastMessagePreview?: string;
  lastMessageAt?: Date;
  alumniUnreadCount: number;
  adminUnreadCount: number;
  alumniArchived: boolean;
  adminArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AlumniInboxThreadSchema = new Schema<IAlumniInboxThread>(
  {
    alumniId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    participantIds: [{ type: Schema.Types.ObjectId, ref: "User", index: true }],
    subject: { type: String, required: true, trim: true, maxlength: 220 },
    lastMessagePreview: { type: String, trim: true, maxlength: 300 },
    lastMessageAt: { type: Date, index: true },
    alumniUnreadCount: { type: Number, default: 0, min: 0 },
    adminUnreadCount: { type: Number, default: 0, min: 0 },
    alumniArchived: { type: Boolean, default: false, index: true },
    adminArchived: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

AlumniInboxThreadSchema.index({ updatedAt: -1 });
AlumniInboxThreadSchema.index({ alumniId: 1, updatedAt: -1 });

const AlumniInboxThread: Model<IAlumniInboxThread> =
  mongoose.models.AlumniInboxThread ||
  mongoose.model<IAlumniInboxThread>("AlumniInboxThread", AlumniInboxThreadSchema);

export default AlumniInboxThread;
