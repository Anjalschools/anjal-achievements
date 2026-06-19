import mongoose, { Schema, Document, Model } from "mongoose";

export type IntelligenceAlertLevel = "info" | "warning" | "critical";
export type IntelligenceAlertKind =
  | "section_unavailable"
  | "slow_query"
  | "aggregation_failure"
  | "environment_failed"
  | "low_health_score"
  | "recovery";

export type IntelligenceAlertStatus = "active" | "resolved";

export interface IIntelligenceHealthAlert extends Document {
  alertKey: string;
  level: IntelligenceAlertLevel;
  kind: IntelligenceAlertKind;
  titleAr: string;
  titleEn: string;
  messageAr: string;
  messageEn: string;
  service?: string;
  section?: string;
  status: IntelligenceAlertStatus;
  firstSeenAt: Date;
  lastSeenAt: Date;
  resolvedAt?: Date;
  downtimeMs?: number;
  occurrenceCount: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const IntelligenceHealthAlertSchema = new Schema<IIntelligenceHealthAlert>(
  {
    alertKey: { type: String, required: true, index: true },
    level: { type: String, enum: ["info", "warning", "critical"], required: true, index: true },
    kind: {
      type: String,
      enum: [
        "section_unavailable",
        "slow_query",
        "aggregation_failure",
        "environment_failed",
        "low_health_score",
        "recovery",
      ],
      required: true,
      index: true,
    },
    titleAr: { type: String, required: true, trim: true },
    titleEn: { type: String, required: true, trim: true },
    messageAr: { type: String, required: true, trim: true },
    messageEn: { type: String, required: true, trim: true },
    service: { type: String, trim: true, index: true },
    section: { type: String, trim: true, index: true },
    status: { type: String, enum: ["active", "resolved"], default: "active", index: true },
    firstSeenAt: { type: Date, required: true },
    lastSeenAt: { type: Date, required: true },
    resolvedAt: { type: Date },
    downtimeMs: { type: Number },
    occurrenceCount: { type: Number, default: 1 },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

IntelligenceHealthAlertSchema.index({ alertKey: 1, status: 1 });
IntelligenceHealthAlertSchema.index({ status: 1, lastSeenAt: -1 });

const IntelligenceHealthAlert: Model<IIntelligenceHealthAlert> =
  mongoose.models.IntelligenceHealthAlert ||
  mongoose.model<IIntelligenceHealthAlert>("IntelligenceHealthAlert", IntelligenceHealthAlertSchema);

export default IntelligenceHealthAlert;
