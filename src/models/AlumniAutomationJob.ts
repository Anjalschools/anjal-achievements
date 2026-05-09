import mongoose, { Document, Model, Schema, Types } from "mongoose";

/** Queue-ready job types — processed by worker/cron or external queue (BullMQ, Cloud Tasks). */
export type AlumniAutomationJobType =
  | "alumni.welcome"
  | "mentorship.pending"
  | "mentorship.reminder"
  | "event.upcoming"
  | "event.invitation"
  | "profile.incomplete"
  | "alumni.inactive"
  | "campaign.launch"
  | "campaign.email";

export type AlumniAutomationJobStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export interface IAlumniAutomationJob extends Document {
  type: AlumniAutomationJobType;
  payload: Record<string, unknown>;
  status: AlumniAutomationJobStatus;
  scheduledFor: Date;
  processedAt?: Date;
  retryCount: number;
  errorMessage?: string;
  /** Optional correlation for observability */
  correlationId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AlumniAutomationJobSchema = new Schema<IAlumniAutomationJob>(
  {
    type: {
      type: String,
      required: true,
      index: true,
      enum: [
        "alumni.welcome",
        "mentorship.pending",
        "mentorship.reminder",
        "event.upcoming",
        "event.invitation",
        "profile.incomplete",
        "alumni.inactive",
        "campaign.launch",
        "campaign.email",
      ],
    },
    payload: { type: Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed", "cancelled"],
      default: "pending",
      index: true,
    },
    scheduledFor: { type: Date, required: true, index: true },
    processedAt: { type: Date },
    retryCount: { type: Number, default: 0, min: 0 },
    errorMessage: { type: String, trim: true, maxlength: 4000 },
    correlationId: { type: String, trim: true, maxlength: 64, index: true, sparse: true },
  },
  { timestamps: true }
);

AlumniAutomationJobSchema.index({ status: 1, scheduledFor: 1 });
AlumniAutomationJobSchema.index({ type: 1, status: 1, scheduledFor: 1 });

const AlumniAutomationJob: Model<IAlumniAutomationJob> =
  mongoose.models.AlumniAutomationJob ||
  mongoose.model<IAlumniAutomationJob>("AlumniAutomationJob", AlumniAutomationJobSchema);

export default AlumniAutomationJob;
