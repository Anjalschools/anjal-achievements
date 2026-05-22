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
import {
  inferAchievementCategoryFromLegacyData,
  shouldApplyLegacyClassification,
  type LegacyClassificationResult,
} from "@/lib/achievement-legacy-classification";
import { resolveStoredAchievementReportCategory } from "@/lib/achievement-report-category";

const SPECIAL_STORED_CATEGORIES = new Set<string>([
  UI_CATEGORY_EARLY_UNIVERSITY,
  UI_CATEGORY_ENTREPRENEURSHIP,
  UI_CATEGORY_TRAINING_COURSES,
]);

const mapReportCategoryToUi = (reportCat: string): UiAchievementCategory | null => {
  const c = String(reportCat || "").trim();
  if (SPECIAL_STORED_CATEGORIES.has(c)) return c as UiAchievementCategory;
  if (c === "standardized_tests" || c === "qudrat" || c === "mawhiba" || c === "gifted_screening") {
    return "standardized_tests";
  }
  if (
    c === "competition" ||
    c === "program" ||
    c === "olympiad" ||
    c === "excellence_program" ||
    c === "other"
  ) {
    return c as UiAchievementCategory;
  }
  return null;
};

const suggestUiCategoryFromLegacyInference = (
  dbType: string,
  storedCategory: string,
  opts?: {
    achievementName?: string;
    customAchievementName?: string;
    description?: string;
    title?: string;
    nameAr?: string;
    nameEn?: string;
  }
): UiAchievementCategory | null => {
  const legacy = inferAchievementCategoryFromLegacyData({
    achievementType: dbType,
    achievementCategory: storedCategory,
    achievementName: opts?.achievementName,
    customAchievementName: opts?.customAchievementName,
    description: opts?.description,
    title: opts?.title,
    nameAr: opts?.nameAr,
    nameEn: opts?.nameEn,
  });
  if (!legacy?.category) return null;
  if (shouldApplyLegacyClassification(legacy)) {
    return legacy.category as UiAchievementCategory;
  }
  if (
    legacy.category === UI_CATEGORY_TRAINING_COURSES &&
    legacy.confidence === "medium" &&
    legacy.matchedSignals.some((s) => s.includes("training"))
  ) {
    return legacy.category as UiAchievementCategory;
  }
  return null;
};

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
  const reportCat = resolveStoredAchievementReportCategory({
    achievementType: dbType,
    achievementCategory: storedCategory,
    achievementName: opts?.achievementName,
    description: opts?.description,
  });
  const fromReport = mapReportCategoryToUi(reportCat);
  if (fromReport) return fromReport;

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
    const inferred = suggestUiCategoryFromLegacyInference(dbType, s, opts);
    if (inferred) return inferred;
  }

  return fromType;
};

/** Expose last inferred classification for admin preview tooling (optional). */
export type { LegacyClassificationResult };
