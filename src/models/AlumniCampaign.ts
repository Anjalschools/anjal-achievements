import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type AlumniCampaignKind =
  | "email_campaign"
  | "alumni_engagement"
  | "reunion_invitation"
  | "mentorship_invitation"
  | "graduation_reminder"
  | "event_promotion";

export type AlumniCampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "cancelled";

/** Audience stored as JSON — resolved server-side (see campaign-audience resolver). */
export type AlumniCampaignAudienceFilter = Record<string, unknown>;

export interface IAlumniCampaign extends Document {
  title: string;
  slug: string;
  kind: AlumniCampaignKind;
  status: AlumniCampaignStatus;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  audienceFilter: AlumniCampaignAudienceFilter;
  scheduledAt?: Date;
  sentAt?: Date;
  createdById?: Types.ObjectId;
  statsDelivered: number;
  statsOpened: number;
  statsClicked: number;
  statsFailed: number;
  createdAt: Date;
  updatedAt: Date;
}

const AlumniCampaignSchema = new Schema<IAlumniCampaign>(
  {
    title: { type: String, required: true, trim: true, maxlength: 240 },
    slug: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
    kind: {
      type: String,
      enum: [
        "email_campaign",
        "alumni_engagement",
        "reunion_invitation",
        "mentorship_invitation",
        "graduation_reminder",
        "event_promotion",
      ],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["draft", "scheduled", "sending", "sent", "cancelled"],
      default: "draft",
      index: true,
    },
    subject: { type: String, required: true, trim: true, maxlength: 300 },
    bodyHtml: { type: String, required: true, maxlength: 100_000 },
    bodyText: { type: String, required: true, maxlength: 50_000 },
    audienceFilter: { type: Schema.Types.Mixed, default: {} },
    scheduledAt: { type: Date, index: true },
    sentAt: { type: Date },
    createdById: { type: Schema.Types.ObjectId, ref: "User", sparse: true },
    statsDelivered: { type: Number, default: 0, min: 0 },
    statsOpened: { type: Number, default: 0, min: 0 },
    statsClicked: { type: Number, default: 0, min: 0 },
    statsFailed: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

AlumniCampaignSchema.index({ status: 1, scheduledAt: 1 });

const AlumniCampaign: Model<IAlumniCampaign> =
  mongoose.models.AlumniCampaign || mongoose.model<IAlumniCampaign>("AlumniCampaign", AlumniCampaignSchema);

export default AlumniCampaign;
