import mongoose, { Schema, Document, Model } from "mongoose";

export type NotificationType =
  | "achievement_approved"
  | "achievement_needs_revision"
  | "achievement_rejected"
  | "achievement_deleted"
  | "achievement_featured"
  | "certificate_issued"
  | "ai_flag_notice"
  | "achievement_submitted_for_review"
  | "achievement_updated_for_review"
  | "system";

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  /** Unread when false — exposed as `isRead` in JSON APIs */
  read: boolean;
  relatedAchievementId?: mongoose.Types.ObjectId;
  relatedCertificateToken?: string;
  metadata?: Record<string, unknown>;
  /** @deprecated use metadata — kept for legacy documents */
  meta?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        "achievement_approved",
        "achievement_needs_revision",
        "achievement_rejected",
        "achievement_deleted",
        "achievement_featured",
        "certificate_issued",
        "ai_flag_notice",
        "achievement_submitted_for_review",
        "achievement_updated_for_review",
        "system",
      ],
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    read: { type: Boolean, default: false, index: true },
    relatedAchievementId: {
      type: Schema.Types.ObjectId,
      ref: "Achievement",
      index: true,
    },
    relatedCertificateToken: { type: String, trim: true, sparse: true },
    metadata: { type: Schema.Types.Mixed },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

const Notification: Model<INotification> =
  mongoose.models.Notification ||
  mongoose.model<INotification>("Notification", NotificationSchema);

export default Notification;
