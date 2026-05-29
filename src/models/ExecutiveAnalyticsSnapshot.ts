import mongoose, { Document, Model, Schema } from "mongoose";

export type ExecutiveSnapshotGranularity = "daily" | "weekly" | "monthly" | "on_demand";

export type ExecutiveSnapshotTrustStatus = "synced" | "partial" | "stale" | "unknown";

export interface IExecutiveAnalyticsSnapshot extends Document {
  filterFingerprint: string;
  granularity: ExecutiveSnapshotGranularity;
  periodStart: Date;
  periodEnd: Date;
  filters: Record<string, unknown>;
  payload: Record<string, unknown>;
  payloadVersion: number;
  aggregationVersion: number;
  trustStatus: ExecutiveSnapshotTrustStatus;
  cacheMeta: {
    source: string;
    generatedAt: string;
    facetMs?: number;
  };
  createdAt: Date;
}

const ExecutiveAnalyticsSnapshotSchema = new Schema<IExecutiveAnalyticsSnapshot>(
  {
    filterFingerprint: { type: String, required: true, index: true },
    granularity: {
      type: String,
      enum: ["daily", "weekly", "monthly", "on_demand"],
      required: true,
      index: true,
    },
    periodStart: { type: Date, required: true, index: true },
    periodEnd: { type: Date, required: true },
    filters: { type: Schema.Types.Mixed, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    payloadVersion: { type: Number, default: 1 },
    aggregationVersion: { type: Number, default: 1, index: true },
    trustStatus: {
      type: String,
      enum: ["synced", "partial", "stale", "unknown"],
      default: "unknown",
    },
    cacheMeta: {
      type: {
        source: String,
        generatedAt: String,
        facetMs: Number,
      },
      default: () => ({ source: "analytics-snapshot-engine", generatedAt: new Date().toISOString() }),
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ExecutiveAnalyticsSnapshotSchema.index(
  { filterFingerprint: 1, granularity: 1, periodStart: -1 },
  { unique: true }
);

const ExecutiveAnalyticsSnapshot: Model<IExecutiveAnalyticsSnapshot> =
  mongoose.models.ExecutiveAnalyticsSnapshot ||
  mongoose.model<IExecutiveAnalyticsSnapshot>(
    "ExecutiveAnalyticsSnapshot",
    ExecutiveAnalyticsSnapshotSchema
  );

export default ExecutiveAnalyticsSnapshot;
