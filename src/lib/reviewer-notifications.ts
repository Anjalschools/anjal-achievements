import mongoose from "mongoose";
import Notification from "@/models/Notification";
import User from "@/models/User";
import { REVIEWER_ROLES_LIST } from "@/lib/review-auth";

/** Notifies all reviewer-role users when a student edits a previously approved achievement. */
export const notifyReviewersAchievementUpdatedForReview = async (input: {
  achievementId: mongoose.Types.ObjectId | string;
  studentName: string;
  achievementTitle: string;
}): Promise<void> => {
  const achId =
    typeof input.achievementId === "string" && mongoose.Types.ObjectId.isValid(input.achievementId)
      ? new mongoose.Types.ObjectId(input.achievementId)
      : input.achievementId instanceof mongoose.Types.ObjectId
        ? input.achievementId
        : null;
  if (!achId) return;

  const reviewers = await User.find({ role: { $in: [...REVIEWER_ROLES_LIST] } })
    .select("_id")
    .lean();

  const title = "تعديل يحتاج مراجعة";
  const message = `قام الطالب ${input.studentName.trim().slice(0, 200)} بتعديل الإنجاز «${input.achievementTitle.trim().slice(0, 200)}» ويحتاج إلى إعادة مراجعة.`;
  const ts = new Date();

  await Promise.all(
    reviewers.map((u) =>
      Notification.create({
        userId: u._id,
        type: "achievement_updated_for_review",
        title,
        message,
        read: false,
        relatedAchievementId: achId,
        metadata: {
          achievementId: achId.toString(),
          studentName: input.studentName.trim().slice(0, 200),
          title: input.achievementTitle.trim().slice(0, 300),
          timestamp: ts.toISOString(),
          type: "achievement_updated_for_review",
        },
      })
    )
  );
};
