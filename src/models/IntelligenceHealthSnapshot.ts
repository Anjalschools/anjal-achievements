import mongoose, { Schema, Document, Model } from "mongoose";

export type IntelligenceEnvironmentStatusMap = {
  mongodb?: "healthy" | "warning" | "failed";
  openai?: "healthy" | "warning" | "failed";
  r2?: "healthy" | "warning" | "failed";
  redis?: "healthy" | "warning" | "failed";
};

export interface IIntelligenceHealthSnapshot extends Document {
  timestamp: Date;
  healthScore: number;
  healthySections: string[];
  unavailableSections: string[];
  slowSections: string[];
  environmentStatus: IntelligenceEnvironmentStatusMap;
  slowQueryCount: number;
  aggregationFailureCount: number;
  totalDurationMs: number;
  createdAt: Date;
  updatedAt: Date;
}

const IntelligenceHealthSnapshotSchema = new Schema<IIntelligenceHealthSnapshot>(
  {
    timestamp: { type: Date, required: true, index: true },
    healthScore: { type: Number, required: true, min: 0, max: 100 },
    healthySections: { type: [String], default: [] },
    unavailableSections: { type: [String], default: [] },
    slowSections: { type: [String], default: [] },
    environmentStatus: { type: Schema.Types.Mixed, default: {} },
    slowQueryCount: { type: Number, default: 0 },
    aggregationFailureCount: { type: Number, default: 0 },
    totalDurationMs: { type: Number, default: 0 },
  },
  { timestamps: true }
);

IntelligenceHealthSnapshotSchema.index({ timestamp: -1 });

const IntelligenceHealthSnapshot: Model<IIntelligenceHealthSnapshot> =
  mongoose.models.IntelligenceHealthSnapshot ||
  mongoose.model<IIntelligenceHealthSnapshot>("IntelligenceHealthSnapshot", IntelligenceHealthSnapshotSchema);

export default IntelligenceHealthSnapshot;
