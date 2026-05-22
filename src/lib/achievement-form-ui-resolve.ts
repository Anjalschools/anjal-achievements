/**
 * Form UI category resolution (isolated to avoid import cycles with achievementDisplay).
 */

import type { UiAchievementCategory } from "@/constants/achievement-ui-categories";
import { mapDbAchievementTypeToUiCategory } from "@/constants/achievement-ui-categories";
import {
  UI_CATEGORY_EARLY_UNIVERSITY,
  UI_CATEGORY_ENTREPRENEURSHIP,
  UI_CATEGORY_TRAINING_COURSES,
} from "@/constants/achievement-special-categories";
import { inferUiCategoryFromStoredAchievement } from "@/lib/achievement-special-category-rules";
import { inferAchievementCategoryFromLegacyData } from "@/lib/achievement-legacy-classification";

const SPECIAL_STORED_CATEGORIES = new Set<string>([
  UI_CATEGORY_EARLY_UNIVERSITY,
  UI_CATEGORY_ENTREPRENEURSHIP,
  UI_CATEGORY_TRAINING_COURSES,
]);

/** UI category for create/edit forms; includes lightweight legacy inference. */
export const resolveAchievementFormUiCategory = (
  dbType: string,
  storedCategory: string | undefined,
  opts?: {
    achievementName?: string;
    customAchievementName?: string;
    description?: string;
    title?: string;
    nameAr?: string;
    nameEn?: string;
    allowLegacyInference?: boolean;
  }
): UiAchievementCategory => {
  const fromType = mapDbAchievementTypeToUiCategory(dbType);
  if (fromType === "standardized_tests") return "standardized_tests";
  const s = String(storedCategory || "").trim();
  if (SPECIAL_STORED_CATEGORIES.has(s)) {
    return s as UiAchievementCategory;
  }
  if (
    s === "qudrat" ||
    s === "mawhiba" ||
    s === "gifted_screening" ||
    s === "standardized_tests"
  ) {
    return "standardized_tests";
  }
  if (
    s === "competition" ||
    s === "program" ||
    s === "olympiad" ||
    s === "training_courses" ||
    s === "excellence_program" ||
    s === "early_university_admission" ||
    s === "entrepreneurship" ||
    s === "other"
  ) {
    return s as UiAchievementCategory;
  }

  const fromStoredSlug = inferUiCategoryFromStoredAchievement({
    achievementType: dbType,
    achievementName: opts?.achievementName,
    achievementCategory: s,
    description: opts?.description,
  });
  if (fromStoredSlug) return fromStoredSlug as UiAchievementCategory;

  const allowInference = opts?.allowLegacyInference !== false;
  if (
    allowInference &&
    (dbType === "program" || dbType === "other" || fromType === "other" || fromType === "program")
  ) {
    const legacy = inferAchievementCategoryFromLegacyData({
      achievementType: dbType,
      achievementCategory: s,
      achievementName: opts?.achievementName,
      customAchievementName: opts?.customAchievementName,
      description: opts?.description,
      title: opts?.title,
      nameAr: opts?.nameAr,
      nameEn: opts?.nameEn,
    });
    if (
      legacy?.category &&
      (legacy.confidence === "high" ||
        (legacy.confidence === "medium" && legacy.matchedSignals.length >= 2))
    ) {
      return legacy.category as UiAchievementCategory;
    }
  }

  return fromType;
};
