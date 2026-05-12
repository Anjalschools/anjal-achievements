/**
 * Maps persisted notification.type → UI filter buckets (notifications page).
 * Keep in sync with filters on `src/app/(app)/notifications/page.tsx`.
 */
export type NotificationUiCategory = "all" | "unread" | "reviews" | "certificates" | "system" | "alumni";

const REVIEW_TYPES = new Set<string>([
  "achievement_submitted_for_review",
  "achievement_updated_for_review",
  "ai_flag_notice",
  "achievement_approved",
  "achievement_needs_revision",
  "achievement_rejected",
  "achievement_featured",
  "achievement_deleted",
]);

export const getNotificationCategory = (type: string): "reviews" | "certificates" | "system" | "general" | "alumni" => {
  const t = String(type || "").trim();
  if (t === "certificate_issued") return "certificates";
  if (t === "system") return "system";
  if (REVIEW_TYPES.has(t)) return "reviews";
  return "general";
};

const isAlumniCommunityNotification = (metadata: Record<string, unknown> | null | undefined): boolean => {
  if (!metadata || typeof metadata !== "object") return false;
  return String((metadata as { channel?: string }).channel || "") === "alumni_community";
};

export const notificationMatchesFilter = (
  type: string,
  filter: NotificationUiCategory,
  isRead: boolean,
  metadata?: Record<string, unknown> | null
): boolean => {
  if (filter === "all") return true;
  if (filter === "unread") return !isRead;
  if (filter === "certificates") return type === "certificate_issued";
  if (filter === "system") return type === "system" && !isAlumniCommunityNotification(metadata);
  if (filter === "reviews") return getNotificationCategory(type) === "reviews";
  if (filter === "alumni") {
    return type === "system" && isAlumniCommunityNotification(metadata);
  }
  return true;
};
