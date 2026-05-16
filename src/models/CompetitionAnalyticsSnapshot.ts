import mongoose, { Document, Model, Schema } from "mongoose";

export type CompetitionSnapshotGranularity = "daily" | "weekly" | "monthly";

export type CiTrustStatusSnapshot = "synced" | "partial" | "mismatch" | "unknown";

export interface ICompetitionAnalyticsSnapshot extends Document {
  granularity: CompetitionSnapshotGranularity;
  periodStart: Date;
  periodEnd: Date;
  payload: Record<string, unknown>;
  payloadVersion: number;
  aggregationVersion: number;
  trustStatus: CiTrustStatusSnapshot;
  cacheMeta: {
    source: string;
    generatedAt: string;
    facetMs?: number;
  };
  createdAt: Date;
}

const CompetitionAnalyticsSnapshotSchema = new Schema<ICompetitionAnalyticsSnapshot>(
  {
    granularity: { type: String, enum: ["daily", "weekly", "monthly"], required: true, index: true },
    periodStart: { type: Date, required: true, index: true },
    periodEnd: { type: Date, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    payloadVersion: { type: Number, default: 1 },
    aggregationVersion: { type: Number, default: 1, index: true },
    trustStatus: {
      type: String,
      enum: ["synced", "partial", "mismatch", "unknown"],
      default: "unknown",
    },
    cacheMeta: {
      type: {
        source: String,
        generatedAt: String,
        facetMs: Number,
      },
      default: () => ({ source: "snapshot-engine", generatedAt: new Date().toISOString() }),
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

CompetitionAnalyticsSnapshotSchema.index({ granularity: 1, periodStart: -1 }, { unique: true });

const CompetitionAnalyticsSnapshot: Model<ICompetitionAnalyticsSnapshot> =
  mongoose.models.CompetitionAnalyticsSnapshot ||
  mongoose.model<ICompetitionAnalyticsSnapshot>(
    "CompetitionAnalyticsSnapshot",
    CompetitionAnalyticsSnapshotSchema
  );

export default CompetitionAnalyticsSnapshot;
