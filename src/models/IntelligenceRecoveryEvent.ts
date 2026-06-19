import mongoose, { Schema, Document, Model } from "mongoose";
import type { IntelligenceServiceDomain } from "@/models/IntelligenceSectionSnapshot";

export type IntelligenceRecoveryOutcome =
  | "retry_success"
  | "snapshot_fallback"
  | "environment_recovered"
  | "query_degraded"
  | "failed";

export interface IIntelligenceRecoveryEvent extends Document {
  domain: IntelligenceServiceDomain;
  section?: string;
  service?: string;
  outcome: IntelligenceRecoveryOutcome;
  retryCount: number;
  recoveredAfterRetry: boolean;
  snapshotFallback: boolean;
  durationMs: number;
  message?: string;
  createdAt: Date;
  updatedAt: Date;
}

const IntelligenceRecoveryEventSchema = new Schema<IIntelligenceRecoveryEvent>(
  {
    domain: {
      type: String,
      enum: [
        "school_improvement",
        "executive_intelligence",
        "partnership_intelligence",
        "achievement_intelligence",
        "leaderboard_intelligence",
      ],
      required: true,
      index: true,
    },
    section: { type: String, index: true },
    service: { type: String, index: true },
    outcome: {
      type: String,
      enum: ["retry_success", "snapshot_fallback", "environment_recovered", "query_degraded", "failed"],
      required: true,
      index: true,
    },
    retryCount: { type: Number, default: 0 },
    recoveredAfterRetry: { type: Boolean, default: false },
    snapshotFallback: { type: Boolean, default: false },
    durationMs: { type: Number, default: 0 },
    message: { type: String, trim: true },
  },
  { timestamps: true }
);

IntelligenceRecoveryEventSchema.index({ createdAt: -1 });

const IntelligenceRecoveryEvent: Model<IIntelligenceRecoveryEvent> =
  mongoose.models.IntelligenceRecoveryEvent ||
  mongoose.model<IIntelligenceRecoveryEvent>("IntelligenceRecoveryEvent", IntelligenceRecoveryEventSchema);

export default IntelligenceRecoveryEvent;
