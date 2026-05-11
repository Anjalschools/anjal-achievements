import mongoose from "mongoose";
import Notification from "@/models/Notification";
import { alumniDebugLog } from "@/lib/alumni/alumni-debug-log";

export type AlumniCommunityNotificationCategory =
  | "memories"
  | "opportunities"
  | "mentoring"
  | "approvals"
  | "networking"
  | "general";

/** In-app notification for alumni community flows (uses `system` type + metadata channel). */
export const createAlumniCommunitySystemNotification = async (opts: {
  userId: mongoose.Types.ObjectId;
  title: string;
  message: string;
  /** UI grouping / future filters — stored under metadata. */
  category?: AlumniCommunityNotificationCategory;
  metadata?: Record<string, unknown>;
}): Promise<void> => {
  await Notification.create({
    userId: opts.userId,
    type: "system",
    title: opts.title.trim().slice(0, 300),
    message: opts.message.trim().slice(0, 4000),
    read: false,
    metadata: {
      channel: "alumni_community",
      category: opts.category ?? "general",
      ...(opts.metadata && Object.keys(opts.metadata).length ? opts.metadata : {}),
    },
  });
  alumniDebugLog("alumni-community-notification", {
    userId: String(opts.userId),
    titleLen: opts.title.length,
  });
};
