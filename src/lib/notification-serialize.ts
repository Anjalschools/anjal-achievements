import type { INotification } from "@/models/Notification";

export type NotificationApiItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  relatedAchievementId: string | null;
  relatedCertificateToken: string | null;
  metadata: Record<string, unknown> | null;
  actionHref: string | null;
};

const asPlain = (n: INotification | Record<string, unknown>): Record<string, unknown> => {
  if (n && typeof (n as INotification).toObject === "function") {
    return (n as INotification).toObject() as Record<string, unknown>;
  }
  return n as Record<string, unknown>;
};

export const serializeNotification = (doc: INotification | Record<string, unknown>): NotificationApiItem => {
  const plain = asPlain(doc);
  const id = String(plain._id ?? "");
  const meta =
    (plain.metadata as Record<string, unknown> | undefined) ??
    (plain.meta as Record<string, unknown> | undefined) ??
    null;
  const isRead = plain.read === true;
  const rel = plain.relatedAchievementId;
  const relatedAchievementId =
    rel && typeof (rel as { toString?: () => string }).toString === "function"
      ? String((rel as { toString: () => string }).toString())
      : null;
  const relatedCertificateToken =
    typeof plain.relatedCertificateToken === "string" ? plain.relatedCertificateToken : null;
  const type = String(plain.type || "");

  const metaHref =
    meta && typeof meta.actionHref === "string" && meta.actionHref.trim().startsWith("/")
      ? meta.actionHref.trim()
      : null;

  let actionHref: string | null = null;
  if (metaHref) {
    actionHref = metaHref;
  } else if (type === "certificate_issued" && relatedCertificateToken) {
    actionHref = `/verify/certificate/${relatedCertificateToken}`;
  } else if (type === "achievement_updated_for_review" || type === "achievement_submitted_for_review") {
    actionHref = relatedAchievementId
      ? `/admin/achievements/review/${relatedAchievementId}`
      : "/admin/achievements/review";
  } else if (type === "ai_flag_notice" && relatedAchievementId) {
    actionHref = `/achievements/${relatedAchievementId}`;
  } else if (relatedAchievementId && type !== "achievement_deleted") {
    actionHref = `/achievements/${relatedAchievementId}`;
  }

  const createdAt =
    plain.createdAt instanceof Date
      ? plain.createdAt.toISOString()
      : typeof plain.createdAt === "string"
        ? plain.createdAt
        : new Date().toISOString();

  return {
    id,
    type,
    title: String(plain.title || ""),
    message: String(plain.message || ""),
    isRead,
    createdAt,
    relatedAchievementId,
    relatedCertificateToken,
    metadata: meta,
    actionHref,
  };
};
