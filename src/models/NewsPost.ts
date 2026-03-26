import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type NewsPostStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "published"
  | "scheduled"
  | "failed";

export type NewsSourceType =
  | "approved_achievement"
  | "certificate"
  | "event"
  | "manual"
  | "achievement_bundle";

export type PublishTarget = "website" | "instagram" | "x" | "tiktok" | "snapchat";

export interface INewsPost extends Document {
  title: string;
  subtitle?: string;
  slug: string;
  sourceType: NewsSourceType;
  sourceIds: Types.ObjectId[];
  locale: "ar" | "en" | "bilingual";
  tone?: string;
  audience?: string;
  category?: string;
  schoolSection?: string;
  namesOrEntities?: string;
  summary?: string;
  rawNotes?: string;
  eventDate?: Date;
  location?: string;
  websiteBody?: string;
  instagramCaption?: string;
  xPostText?: string;
  snapchatText?: string;
  tiktokCaption?: string;
  bilingualBody?: string;
  hashtags: string[];
  coverImage?: string;
  attachments: string[];
  status: NewsPostStatus;
  publishTargets: PublishTarget[];
  publishResults: Array<{
    target: PublishTarget;
    success: boolean;
    at?: Date;
    errorMessage?: string;
    externalId?: string;
  }>;
  aiGenerationMeta?: Record<string, unknown>;
  createdBy?: Types.ObjectId;
  approvedBy?: Types.ObjectId;
  publishedBy?: Types.ObjectId;
  scheduledFor?: Date;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PublishResultSchema = new Schema(
  {
    target: { type: String, required: true },
    success: { type: Boolean, required: true },
    at: { type: Date },
    errorMessage: { type: String, trim: true },
    externalId: { type: String, trim: true },
  },
  { _id: false }
);

const NewsPostSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 500 },
    subtitle: { type: String, trim: true, maxlength: 500 },
    slug: { type: String, required: true, trim: true, lowercase: true, index: true },
    sourceType: {
      type: String,
      enum: ["approved_achievement", "certificate", "event", "manual", "achievement_bundle"],
      required: true,
      index: true,
    },
    sourceIds: [{ type: Schema.Types.ObjectId }],
    locale: { type: String, enum: ["ar", "en", "bilingual"], default: "ar" },
    tone: { type: String, trim: true },
    audience: { type: String, trim: true },
    category: { type: String, trim: true },
    schoolSection: { type: String, trim: true },
    namesOrEntities: { type: String, trim: true },
    summary: { type: String, trim: true, maxlength: 8000 },
    rawNotes: { type: String, trim: true, maxlength: 16000 },
    eventDate: { type: Date },
    location: { type: String, trim: true },
    websiteBody: { type: String, trim: true, maxlength: 100000 },
    instagramCaption: { type: String, trim: true, maxlength: 8000 },
    xPostText: { type: String, trim: true, maxlength: 8000 },
    snapchatText: { type: String, trim: true, maxlength: 8000 },
    tiktokCaption: { type: String, trim: true, maxlength: 8000 },
    bilingualBody: { type: String, trim: true, maxlength: 100000 },
    hashtags: [{ type: String, trim: true }],
    coverImage: { type: String, trim: true },
    attachments: [{ type: String, trim: true }],
    status: {
      type: String,
      enum: ["draft", "pending_review", "approved", "published", "scheduled", "failed"],
      default: "draft",
      index: true,
    },
    publishTargets: [{ type: String }],
    publishResults: [PublishResultSchema],
    aiGenerationMeta: { type: Schema.Types.Mixed },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", index: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    publishedBy: { type: Schema.Types.ObjectId, ref: "User" },
    scheduledFor: { type: Date, index: true },
    publishedAt: { type: Date },
  },
  { timestamps: true }
);

NewsPostSchema.index({ createdAt: -1 });
NewsPostSchema.index({ status: 1, createdAt: -1 });
NewsPostSchema.index({ slug: 1 }, { unique: true });

const NewsPost: Model<INewsPost> =
  mongoose.models.NewsPost || mongoose.model<INewsPost>("NewsPost", NewsPostSchema);

export default NewsPost;
