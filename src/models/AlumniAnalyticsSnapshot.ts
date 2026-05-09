import mongoose, { Document, Model, Schema } from "mongoose";

export type AlumniSnapshotGranularity = "daily" | "weekly" | "monthly";

export interface IAlumniAnalyticsSnapshot extends Document {
  granularity: AlumniSnapshotGranularity;
  periodStart: Date;
  periodEnd: Date;
  /** Precomputed metrics blob — versioned for forward compatibility */
  payload: Record<string, unknown>;
  payloadVersion: number;
  createdAt: Date;
}

const AlumniAnalyticsSnapshotSchema = new Schema<IAlumniAnalyticsSnapshot>(
  {
    granularity: { type: String, enum: ["daily", "weekly", "monthly"], required: true, index: true },
    periodStart: { type: Date, required: true, index: true },
    periodEnd: { type: Date, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    payloadVersion: { type: Number, default: 1 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AlumniAnalyticsSnapshotSchema.index({ granularity: 1, periodStart: -1 }, { unique: true });

const AlumniAnalyticsSnapshot: Model<IAlumniAnalyticsSnapshot> =
  mongoose.models.AlumniAnalyticsSnapshot ||
  mongoose.model<IAlumniAnalyticsSnapshot>("AlumniAnalyticsSnapshot", AlumniAnalyticsSnapshotSchema);

export default AlumniAnalyticsSnapshot;
