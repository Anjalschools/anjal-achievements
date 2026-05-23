/**
 * Display taxonomy: achievementCategory first, achievementType fallback only.
 */

import { getDbAchievementTypeLabel } from "@/lib/achievement-labels";
import { resolveStoredAchievementReportCategory } from "@/lib/achievement-report-category";

export type DisplayCategoryDoc = {
  achievementType?: string;
  achievementCategory?: string;
  achievementName?: string;
  description?: string;
};

export const resolveDisplayAchievementCategory = (doc: DisplayCategoryDoc): string =>
  resolveStoredAchievementReportCategory({
    achievementType: doc.achievementType,
    achievementCategory: doc.achievementCategory,
    achievementName: doc.achievementName,
    description: doc.description,
  });

export const getDisplayAchievementCategoryLabel = (
  doc: DisplayCategoryDoc,
  locale: "ar" | "en"
): string => {
  const key = resolveDisplayAchievementCategory(doc);
  return getDbAchievementTypeLabel(key, locale);
};
