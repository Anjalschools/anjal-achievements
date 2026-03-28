/**
 * Maps persisted notification.type → UI filter buckets (notifications page).
 * Keep in sync with filters on `src/app/(app)/notifications/page.tsx`.
 */
export type NotificationUiCategory = "all" | "unread" | "reviews" | "certificates" | "system";

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

export const getNotificationCategory = (type: string): "reviews" | "certificates" | "system" | "general" => {
  const t = String(type || "").trim();
  if (t === "certificate_issued") return "certificates";
  if (t === "system") return "system";
  if (REVIEW_TYPES.has(t)) return "reviews";
  return "general";
};

export const notificationMatchesFilter = (
  type: string,
  filter: NotificationUiCategory,
  isRead: boolean
): boolean => {
  if (filter === "all") return true;
  if (filter === "unread") return !isRead;
  if (filter === "certificates") return type === "certificate_issued";
  if (filter === "system") return type === "system";
  if (filter === "reviews") return getNotificationCategory(type) === "reviews";
  return true;
};
