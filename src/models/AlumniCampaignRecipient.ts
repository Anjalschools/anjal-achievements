import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type AlumniCampaignRecipientStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "failed"
  | "bounced"
  | "skipped";

export interface IAlumniCampaignRecipient extends Document {
  campaignId: Types.ObjectId;
  userId: Types.ObjectId;
  emailSnapshot: string;
  status: AlumniCampaignRecipientStatus;
  trackingToken: string;
  sentAt?: Date;
  openedAt?: Date;
  clickedAt?: Date;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AlumniCampaignRecipientSchema = new Schema<IAlumniCampaignRecipient>(
  {
    campaignId: { type: Schema.Types.ObjectId, ref: "AlumniCampaign", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    emailSnapshot: { type: String, required: true, trim: true, lowercase: true, maxlength: 320 },
    status: {
      type: String,
      enum: ["pending", "sent", "delivered", "opened", "clicked", "failed", "bounced", "skipped"],
      default: "pending",
      index: true,
    },
    trackingToken: { type: String, required: true, unique: true, index: true },
    sentAt: { type: Date },
    openedAt: { type: Date },
    clickedAt: { type: Date },
    errorMessage: { type: String, trim: true, maxlength: 2000 },
  },
  { timestamps: true }
);

AlumniCampaignRecipientSchema.index({ campaignId: 1, userId: 1 }, { unique: true });

const AlumniCampaignRecipient: Model<IAlumniCampaignRecipient> =
  mongoose.models.AlumniCampaignRecipient ||
  mongoose.model<IAlumniCampaignRecipient>("AlumniCampaignRecipient", AlumniCampaignRecipientSchema);

export default AlumniCampaignRecipient;
