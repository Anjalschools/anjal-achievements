import mongoose from "mongoose";
import Notification from "@/models/Notification";
import { notificationDebugLog } from "@/lib/notification-debug";

export const STUDENT_NOTIFICATION_TYPES = [
  "achievement_approved",
  "achievement_needs_revision",
  "achievement_rejected",
  "achievement_deleted",
  "achievement_featured",
  "certificate_issued",
  "ai_flag_notice",
  "system",
] as const;

export type StudentNotificationType = (typeof STUDENT_NOTIFICATION_TYPES)[number];

export type CreateStudentNotificationInput = {
  userId: mongoose.Types.ObjectId;
  type: StudentNotificationType;
  title: string;
  message: string;
  relatedAchievementId?: mongoose.Types.ObjectId | string | null;
  relatedCertificateToken?: string | null;
  metadata?: Record<string, unknown>;
};

/** Persist unread as `read: false` (legacy field); API exposes `isRead`. */
export const createStudentNotification = async (
  input: CreateStudentNotificationInput
): Promise<void> => {
  const relatedAchievementId =
    input.relatedAchievementId == null
      ? undefined
      : typeof input.relatedAchievementId === "string" &&
          mongoose.Types.ObjectId.isValid(input.relatedAchievementId)
        ? new mongoose.Types.ObjectId(input.relatedAchievementId)
        : input.relatedAchievementId instanceof mongoose.Types.ObjectId
          ? input.relatedAchievementId
          : undefined;

  await Notification.create({
    userId: input.userId,
    type: input.type,
    title: input.title.trim().slice(0, 300),
    message: input.message.trim().slice(0, 4000),
    read: false,
    relatedAchievementId,
    relatedCertificateToken: input.relatedCertificateToken?.trim().slice(0, 128) || undefined,
    metadata:
      input.metadata && Object.keys(input.metadata).length > 0 ? input.metadata : undefined,
  });
  notificationDebugLog("notification_created", {
    scope: "student",
    type: input.type,
    userId: String(input.userId),
  });
};

export const achievementDisplayTitle = (doc: {
  nameAr?: string | null;
  nameEn?: string | null;
  achievementName?: string | null;
  title?: string | null;
}): string => {
  const t =
    String(doc.nameAr || "").trim() ||
    String(doc.nameEn || "").trim() ||
    String(doc.achievementName || "").trim() ||
    String(doc.title || "").trim() ||
    "إنجاز";
  return t.slice(0, 200);
};
