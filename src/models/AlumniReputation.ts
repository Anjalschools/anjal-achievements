import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type AlumniReputationTierName =
  | "Bronze"
  | "Silver"
  | "Gold"
  | "Elite"
  | "Ambassador"
  | "Legend";

export interface IAlumniReputation extends Document {
  userId: Types.ObjectId;
  /** Aggregate 0–1000 (aligned with legacy cached score on User). */
  reputationScore: number;
  mentorshipScore: number;
  communityContributionScore: number;
  eventParticipationScore: number;
  careerImpactScore: number;
  verificationScore: number;
  networkStrengthScore: number;
  contentContributionScore: number;
  lastCalculatedAt: Date;
  badges: string[];
  /** Ordered tier ladder achieved up to current level (additive trail). */
  tiers: string[];
  createdAt: Date;
  updatedAt: Date;
}

const AlumniReputationSchema = new Schema<IAlumniReputation>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    reputationScore: { type: Number, required: true, min: 0, max: 10_000, default: 0 },
    mentorshipScore: { type: Number, default: 0, min: 0 },
    communityContributionScore: { type: Number, default: 0, min: 0 },
    eventParticipationScore: { type: Number, default: 0, min: 0 },
    careerImpactScore: { type: Number, default: 0, min: 0 },
    verificationScore: { type: Number, default: 0, min: 0 },
    networkStrengthScore: { type: Number, default: 0, min: 0 },
    contentContributionScore: { type: Number, default: 0, min: 0 },
    lastCalculatedAt: { type: Date, required: true, index: true },
    badges: [{ type: String, trim: true, maxlength: 80 }],
    tiers: [{ type: String, trim: true, maxlength: 40 }],
  },
  { timestamps: true }
);

AlumniReputationSchema.index({ reputationScore: -1 });

const AlumniReputation: Model<IAlumniReputation> =
  mongoose.models.AlumniReputation || mongoose.model<IAlumniReputation>("AlumniReputation", AlumniReputationSchema);

export default AlumniReputation;
