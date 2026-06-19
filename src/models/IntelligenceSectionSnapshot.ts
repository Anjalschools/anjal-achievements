import mongoose, { Schema, Document, Model } from "mongoose";

export type IntelligenceSnapshotKind = "section" | "query" | "full_payload";

export type IntelligenceServiceDomain =
  | "school_improvement"
  | "executive_intelligence"
  | "partnership_intelligence"
  | "achievement_intelligence"
  | "leaderboard_intelligence";

export interface IIntelligenceSectionSnapshot extends Document {
  key: string;
  domain: IntelligenceServiceDomain;
  kind: IntelligenceSnapshotKind;
  payload: unknown;
  capturedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const IntelligenceSectionSnapshotSchema = new Schema<IIntelligenceSectionSnapshot>(
  {
    key: { type: String, required: true, index: true },
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
    kind: { type: String, enum: ["section", "query", "full_payload"], required: true, index: true },
    payload: { type: Schema.Types.Mixed, required: true },
    capturedAt: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

IntelligenceSectionSnapshotSchema.index({ key: 1, kind: 1 }, { unique: true });

const IntelligenceSectionSnapshot: Model<IIntelligenceSectionSnapshot> =
  mongoose.models.IntelligenceSectionSnapshot ||
  mongoose.model<IIntelligenceSectionSnapshot>("IntelligenceSectionSnapshot", IntelligenceSectionSnapshotSchema);

export default IntelligenceSectionSnapshot;
