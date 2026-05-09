import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type AlumniMentorshipStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "completed"
  | "cancelled";

export interface IAlumniMentorshipRequest extends Document {
  requesterId: Types.ObjectId;
  mentorId: Types.ObjectId;
  category: string;
  message: string;
  status: AlumniMentorshipStatus;
  scheduledAt?: Date;
  notes?: string;
  meetingLink?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AlumniMentorshipRequestSchema = new Schema<IAlumniMentorshipRequest>(
  {
    requesterId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    mentorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    category: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 4000 },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "completed", "cancelled"],
      default: "pending",
      index: true,
    },
    scheduledAt: { type: Date },
    notes: { type: String, trim: true, maxlength: 2000 },
    meetingLink: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: true }
);

AlumniMentorshipRequestSchema.index({ mentorId: 1, status: 1, updatedAt: -1 });
AlumniMentorshipRequestSchema.index({ requesterId: 1, updatedAt: -1 });

const AlumniMentorshipRequest: Model<IAlumniMentorshipRequest> =
  mongoose.models.AlumniMentorshipRequest ||
  mongoose.model<IAlumniMentorshipRequest>("AlumniMentorshipRequest", AlumniMentorshipRequestSchema);

export default AlumniMentorshipRequest;
