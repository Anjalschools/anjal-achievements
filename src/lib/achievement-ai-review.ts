/**
 * AI pre-review layer: combines heuristics + rule checks.
 * Does NOT auto-reject, auto-approve, or auto-delete — only flags for human reviewers.
 */

import mongoose from "mongoose";
import Achievement from "@/models/Achievement";
import {
  checkLevelMismatchHeuristic,
  DUPLICATE_FLAG,
  LEVEL_MISMATCH_FLAG,
  normalizeAchievementIdentityKey,
} from "@/lib/achievement-review-rules";

export type AiReviewStatus = "clean" | "flagged" | "error";

export type AiSuggestedAction =
  | "review"
  | "needs_revision"
  | "possible_duplicate"
  | "possible_level_mismatch";

export type AchievementAiReviewResult = {
  aiReviewStatus: AiReviewStatus;
  aiFlags: string[];
  aiSummary: string;
  aiConfidence: number;
  aiSuggestedAction: AiSuggestedAction;
  aiReviewedAt: Date;
};

export type RunAiReviewParams = {
  userId: string;
  achievementId: string;
  achievementYear: number;
  achievementName: string;
  achievementLevel: string;
  achievementType: string;
  resultType?: string;
  locale?: "ar" | "en";
};

const checkDuplicateSameYearDb = async (input: {
  userId: string;
  achievementYear: number;
  identityKey: string;
  excludeAchievementId: string;
}): Promise<boolean> => {
  const { userId, achievementYear, identityKey, excludeAchievementId } = input;
  if (!identityKey) return false;

  const uid = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;

  const q: Record<string, unknown> = {
    userId: uid,
    achievementYear,
  };
  if (/^[a-fA-F0-9]{24}$/.test(excludeAchievementId)) {
    q._id = { $ne: new mongoose.Types.ObjectId(excludeAchievementId) };
  }

  const candidates = await Achievement.find(q)
    .select("achievementName nameAr nameEn title customAchievementName")
    .lean();

  for (const row of candidates) {
    const r = row as unknown as Record<string, unknown>;
    const name = String(
      r.achievementName || r.nameAr || r.nameEn || r.title || r.customAchievementName || ""
    ).trim();
    if (normalizeAchievementIdentityKey(name) === identityKey) return true;
  }
  return false;
};

const summarize = (
  flags: string[],
  dup: boolean,
  levelMismatch: boolean,
  locale: "ar" | "en"
): string => {
  const parts: string[] = [];
  if (dup) {
    parts.push(
      locale === "ar"
        ? "اشتباه بتسجيل نفس الفعالية أو مسابقة مماثلة في نفس السنة."
        : "Possible duplicate: same competition identity in the same year."
    );
  }
  if (levelMismatch) {
    parts.push(
      locale === "ar"
        ? "المستوى المعلن قد لا يتوافق مع طبيعة الفعالية المعروفة."
        : "Declared level may be inconsistent with the known scope of this event."
    );
  }
  if (flags.length === 0 && parts.length === 0) {
    return locale === "ar"
      ? "لم تُستخرج إشارات تلقائية — يُنصح بمراجعة بشرية روتينية."
      : "No automatic signals — routine human review recommended.";
  }
  return parts.join(" ");
};

export const runAchievementAiReview = async (
  params: RunAiReviewParams
): Promise<AchievementAiReviewResult> => {
  const locale = params.locale === "en" ? "en" : "ar";
  const identityKey = normalizeAchievementIdentityKey(params.achievementName);
  const flags: string[] = [];

  let duplicate = false;
  try {
    duplicate = await checkDuplicateSameYearDb({
      userId: params.userId,
      achievementYear: params.achievementYear,
      identityKey,
      excludeAchievementId: params.achievementId,
    });
  } catch {
    flags.push("duplicate_check_error");
  }
  if (duplicate) flags.push(DUPLICATE_FLAG);

  const levelCheck = checkLevelMismatchHeuristic(params.achievementName, params.achievementLevel);
  if (levelCheck.mismatch) flags.push(LEVEL_MISMATCH_FLAG);

  const basic: string[] = [];
  if (!params.achievementYear || params.achievementYear < 1990 || params.achievementYear > 2100) {
    basic.push("invalid_year");
  }
  if (!String(params.achievementName || "").trim()) {
    basic.push("missing_name");
  }

  const hasIssue = flags.length > 0 || basic.length > 0;
  const aiReviewStatus: AiReviewStatus = hasIssue ? "flagged" : "clean";

  let aiSuggestedAction: AiSuggestedAction = "review";
  if (duplicate) aiSuggestedAction = "possible_duplicate";
  else if (levelCheck.mismatch) aiSuggestedAction = "possible_level_mismatch";
  else if (basic.length > 0) aiSuggestedAction = "needs_revision";

  const aiConfidence = duplicate || levelCheck.mismatch ? 0.72 : basic.length ? 0.55 : 0.88;

  const aiSummary = summarize(flags, duplicate, levelCheck.mismatch, locale);

  return {
    aiReviewStatus,
    aiFlags: [...flags, ...basic.map((b) => `basic:${b}`)],
    aiSummary,
    aiConfidence,
    aiSuggestedAction,
    aiReviewedAt: new Date(),
  };
};

export function applyAiReviewToDoc(
  doc: {
    set: (k: string, v: unknown) => void;
  },
  result: AchievementAiReviewResult
): void {
  doc.set("aiReviewStatus", result.aiReviewStatus);
  doc.set("aiFlags", result.aiFlags);
  doc.set("aiSummary", result.aiSummary);
  doc.set("aiConfidence", result.aiConfidence);
  doc.set("aiSuggestedAction", result.aiSuggestedAction);
  doc.set("aiReviewedAt", result.aiReviewedAt);
}
