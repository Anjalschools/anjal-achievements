/**
 * Admin duplicate review: same student + normalized achievement name + year (year-only rule).
 */

import mongoose from "mongoose";
import Achievement from "@/models/Achievement";
import {
  normalizeAchievementNameForDuplicateKey,
  resolveAchievementComparableYearFromDoc,
  resolveComparableAchievementNameForDuplicate,
} from "@/lib/achievement-duplicate";

export type AdminDuplicateReviewItem = {
  id: string;
  title: string;
  achievementYear: number;
  updatedAt: string | null;
  status?: string;
};

export type AdminDuplicateReviewSummary = {
  hasDuplicate: boolean;
  count: number;
  items: AdminDuplicateReviewItem[];
  comparableYear: number;
  nameKeyNormalized: string;
};

const achievementTitleFromDoc = (r: Record<string, unknown>): string => {
  const t = String(
    r.achievementName ||
      r.nameAr ||
      r.nameEn ||
      r.title ||
      r.customAchievementName ||
      ""
  ).trim();
  return t || "—";
};

/**
 * Other achievements for the same user + same normalized name + same comparable year (excludes current id).
 */
export const buildDuplicateReviewSummaryForAchievement = async (
  achievementId: string
): Promise<AdminDuplicateReviewSummary | null> => {
  if (!achievementId || !mongoose.Types.ObjectId.isValid(achievementId)) return null;

  const doc = await Achievement.findById(achievementId)
    .select(
      "userId achievementName customAchievementName date achievementYear status updatedAt nameAr nameEn title"
    )
    .lean();

  if (!doc) return null;

  const row = doc as unknown as Record<string, unknown>;
  const uid = row.userId as mongoose.Types.ObjectId | undefined;
  if (!uid) return null;

  const comparableYear = resolveAchievementComparableYearFromDoc(row);
  const comparableName = resolveComparableAchievementNameForDuplicate({
    achievementName: String(row.achievementName || ""),
    customAchievementName: String(row.customAchievementName || ""),
  });
  const nameKeyNormalized = normalizeAchievementNameForDuplicateKey(comparableName);
  if (!nameKeyNormalized) {
    return {
      hasDuplicate: false,
      count: 0,
      items: [],
      comparableYear,
      nameKeyNormalized: "",
    };
  }

  const excludeId = new mongoose.Types.ObjectId(achievementId);
  const rows = await Achievement.find({ userId: uid })
    .select(
      "achievementName customAchievementName date achievementYear status updatedAt nameAr nameEn title"
    )
    .lean();

  const items: AdminDuplicateReviewItem[] = [];

  for (const cand of rows) {
    const r = cand as unknown as Record<string, unknown>;
    const id = r._id as mongoose.Types.ObjectId | undefined;
    if (!id || id.equals(excludeId)) continue;

    const comp = resolveComparableAchievementNameForDuplicate({
      achievementName: String(r.achievementName || ""),
      customAchievementName: String(r.customAchievementName || ""),
    });
    if (normalizeAchievementNameForDuplicateKey(comp) !== nameKeyNormalized) continue;
    if (resolveAchievementComparableYearFromDoc(r) !== comparableYear) continue;

    const updatedAt =
      r.updatedAt instanceof Date && !Number.isNaN(r.updatedAt.getTime())
        ? r.updatedAt.toISOString()
        : null;

    items.push({
      id: String(id),
      title: achievementTitleFromDoc(r),
      achievementYear: resolveAchievementComparableYearFromDoc(r),
      updatedAt,
      status: String(r.status || ""),
    });
  }

  return {
    hasDuplicate: items.length > 0,
    count: items.length,
    items: items.slice(0, 20),
    comparableYear,
    nameKeyNormalized,
  };
};
