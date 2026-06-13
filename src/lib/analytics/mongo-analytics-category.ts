import "server-only";

import { EARLY_UNIVERSITY_EVENT_VALUES } from "@/constants/achievement-special-categories";
import { EXTENDED_REPORT_CATEGORY_VALUES } from "@/lib/achievement-report-category";

const ALLOWED_CATEGORIES = [...EXTENDED_REPORT_CATEGORY_VALUES];
const UNIVERSITY_SLUGS = [...EARLY_UNIVERSITY_EVENT_VALUES].filter((s) => s !== "early_uni_other");
const STANDARDIZED_TYPES = [
  "qudrat",
  "mawhiba_annual",
  "mawhiba",
  "gifted_discovery",
  "gifted_screening",
  "sat",
  "ielts",
  "toefl",
];
const TRAINING_MODE_SLUGS = ["online", "in_person", "summer_training"];

/**
 * Mongo `$addFields` expression: canonical analytics category per row.
 * Mirrors `resolveStoredAchievementReportCategory` for common stored/slug cases.
 */
export const mongoAnalyticsCategoryExpression = (): Record<string, unknown> => ({
  $let: {
    vars: {
      cat: {
        $toLower: { $trim: { input: { $ifNull: ["$achievementCategory", ""] } } },
      },
      typ: {
        $toLower: { $trim: { input: { $ifNull: ["$achievementType", ""] } } },
      },
      name: {
        $toLower: { $trim: { input: { $ifNull: ["$achievementName", ""] } } },
      },
    },
    in: {
      $switch: {
        branches: [
          {
            case: { $in: ["$$cat", ALLOWED_CATEGORIES] },
            then: "$$cat",
          },
          {
            case: { $in: ["$$name", [...UNIVERSITY_SLUGS]] },
            then: "early_university_admission",
          },
          {
            case: { $eq: [{ $substrCP: ["$$name", 0, 4] }, "ent_"] },
            then: "entrepreneurship",
          },
          {
            case: { $eq: ["$$name", "summer_training"] },
            then: "summer_training",
          },
          {
            case: { $in: ["$$typ", ["summer_training"]] },
            then: "summer_training",
          },
          {
            case: { $in: ["$$name", TRAINING_MODE_SLUGS] },
            then: "training_courses",
          },
          {
            case: { $in: ["$$typ", STANDARDIZED_TYPES] },
            then: "standardized_tests",
          },
          {
            case: { $eq: ["$$typ", "exhibition"] },
            then: "other",
          },
          {
            case: { $in: ["$$typ", ALLOWED_CATEGORIES] },
            then: "$$typ",
          },
        ],
        default: {
          $cond: [
            { $ne: ["$$cat", ""] },
            "$$cat",
            { $cond: [{ $ne: ["$$typ", ""] }, "$$typ", "other"] },
          ],
        },
      },
    },
  },
});

/** Spread into an existing `$addFields` stage or use standalone. */
export const mongoAnalyticsCategoryAddFields = (): Record<string, unknown> => ({
  analyticsCategory: mongoAnalyticsCategoryExpression(),
});
