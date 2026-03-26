import mongoose, { Schema, Document, Model } from "mongoose";

export type SocialProvider = "instagram" | "x" | "tiktok" | "snapchat";

export type SocialIntegrationStatus = "connected" | "disconnected" | "error" | "pending";

export interface ISocialIntegration extends Document {
  provider: SocialProvider;
  accountLabel?: string;
  accountId?: string;
  status: SocialIntegrationStatus;
  scopes: string[];
  encryptedAccessToken?: string;
  encryptedRefreshToken?: string;
  tokenExpiresAt?: Date;
  lastSyncAt?: Date;
  lastPublishAt?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const SocialIntegrationSchema = new Schema(
  {
    provider: {
      type: String,
      enum: ["instagram", "x", "tiktok", "snapchat"],
      required: true,
      unique: true,
      index: true,
    },
    accountLabel: { type: String, trim: true },
    accountId: { type: String, trim: true },
    status: {
      type: String,
      enum: ["connected", "disconnected", "error", "pending"],
      default: "disconnected",
      index: true,
    },
    scopes: [{ type: String, trim: true }],
    encryptedAccessToken: { type: String, select: false },
    encryptedRefreshToken: { type: String, select: false },
    tokenExpiresAt: { type: Date },
    lastSyncAt: { type: Date },
    lastPublishAt: { type: Date },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

const SocialIntegration: Model<ISocialIntegration> =
  mongoose.models.SocialIntegration ||
  mongoose.model<ISocialIntegration>("SocialIntegration", SocialIntegrationSchema);

export default SocialIntegration;
