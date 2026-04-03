import mongoose from "mongoose";
import Notification from "@/models/Notification";
import User from "@/models/User";
import type { NotificationType } from "@/models/Notification";
import type { IUser } from "@/models/User";
import { ACHIEVEMENT_REVIEWER_ROLES_LIST } from "@/lib/achievement-reviewer-roles";
import { PERMISSIONS } from "@/constants/permissions";
import { notificationDebugLog } from "@/lib/notification-debug";
import { achievementVisibleToStaff } from "@/lib/achievement-scope-filter";

const toObjectId = (id: mongoose.Types.ObjectId | string): mongoose.Types.ObjectId | null => {
  if (typeof id === "string" && mongoose.Types.ObjectId.isValid(id)) {
    return new mongoose.Types.ObjectId(id);
  }
  if (id instanceof mongoose.Types.ObjectId) return id;
  return null;
};

/**
 * Users who should receive in-app achievement queue alerts (roles + explicit review permission).
 * Excludes `student` even if misconfigured with review permission.
 */
export const getAchievementReviewerRecipientUserIds = async (): Promise<mongoose.Types.ObjectId[]> => {
  const list = await User.find({
    status: { $in: ["active", "suspended"] },
    $or: [
      { role: { $in: [...ACHIEVEMENT_REVIEWER_ROLES_LIST] } },
      { permissions: PERMISSIONS.achievementsReview },
    ],
  })
    .select("_id role")
    .lean();

  const seen = new Set<string>();
  const out: mongoose.Types.ObjectId[] = [];
  for (const row of list) {
    const role = String((row as { role?: string }).role || "");
    if (role === "student") continue;
    const id = row._id as mongoose.Types.ObjectId;
    const key = String(id);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(id);
  }

  notificationDebugLog("reviewer_recipients_resolved", { count: out.length });
  return out;
};

/** Drop reviewers who cannot see this achievement under organizational staff scope. */
const filterRecipientIdsByAchievementScope = async (
  achievementId: mongoose.Types.ObjectId,
  candidateIds: mongoose.Types.ObjectId[]
): Promise<mongoose.Types.ObjectId[]> => {
  if (candidateIds.length === 0) return [];
  const users = await User.find({ _id: { $in: candidateIds } }).lean();
  const out: mongoose.Types.ObjectId[] = [];
  for (const row of users) {
    const visible = await achievementVisibleToStaff(
      achievementId.toString(),
      row as unknown as IUser
    );
    if (visible) out.push(row._id as mongoose.Types.ObjectId);
  }
  return out;
};

const notifyReviewers = async (input: {
  type: NotificationType;
  title: string;
  message: string;
  achievementId: mongoose.Types.ObjectId;
  metadataExtra?: Record<string, unknown>;
}): Promise<void> => {
  const candidates = await getAchievementReviewerRecipientUserIds();
  const recipientIds = await filterRecipientIdsByAchievementScope(
    input.achievementId,
    candidates
  );
  if (recipientIds.length === 0) {
    notificationDebugLog("notification_skipped", {
      reason: "no_recipients_after_scope",
      type: input.type,
    });
    return;
  }

  const achId = input.achievementId;
  const href = `/admin/achievements/review/${achId.toString()}`;
  const ts = new Date().toISOString();
  const metadata: Record<string, unknown> = {
    achievementId: achId.toString(),
    timestamp: ts,
    type: input.type,
    actionHref: href,
    ...input.metadataExtra,
  };

  const docs = recipientIds.map((userId) => ({
    userId,
    type: input.type,
    title: input.title.trim().slice(0, 300),
    message: input.message.trim().slice(0, 4000),
    read: false,
    relatedAchievementId: achId,
    metadata,
  }));

  try {
    await Notification.insertMany(docs, { ordered: false });
    notificationDebugLog("notification_created", {
      type: input.type,
      recipientCount: docs.length,
      achievementId: achId.toString(),
    });
  } catch (e) {
    console.error("[notifyReviewers] insertMany", e);
    notificationDebugLog("notification_skipped", { reason: "insert_error", type: input.type });
  }
};

/** New student submission (pending review). */
export const notifyReviewersAchievementSubmittedForReview = async (input: {
  achievementId: mongoose.Types.ObjectId | string;
  studentName: string;
  achievementTitle: string;
}): Promise<void> => {
  const achId = toObjectId(input.achievementId);
  if (!achId) return;

  const studentName = input.studentName.trim().slice(0, 200) || "طالب";
  const title = input.achievementTitle.trim().slice(0, 200) || "إنجاز";

  await notifyReviewers({
    type: "achievement_submitted_for_review",
    title: "إنجاز جديد بانتظار المراجعة",
    message: `قدّم الطالب ${studentName} إنجازًا جديدًا «${title}» وهو بانتظار المراجعة في الطابور.`,
    achievementId: achId,
    metadataExtra: { studentName, achievementTitle: title },
  });
};

/** Student edited an approved achievement, resubmitted after revision/rejection, or re-entered re-review. */
export const notifyReviewersAchievementUpdatedForReview = async (input: {
  achievementId: mongoose.Types.ObjectId | string;
  studentName: string;
  achievementTitle: string;
}): Promise<void> => {
  const achId = toObjectId(input.achievementId);
  if (!achId) return;

  const studentName = input.studentName.trim().slice(0, 200) || "طالب";
  const achievementTitle = input.achievementTitle.trim().slice(0, 200) || "إنجاز";

  await notifyReviewers({
    type: "achievement_updated_for_review",
    title: "تعديل يحتاج مراجعة",
    message: `قام الطالب ${studentName} بتعديل الإنجاز «${achievementTitle}» ويحتاج إلى إعادة مراجعة.`,
    achievementId: achId,
    metadataExtra: { studentName, achievementTitle },
  });
};
