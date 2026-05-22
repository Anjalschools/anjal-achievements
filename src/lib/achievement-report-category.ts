/**
 * Report / filter / analytics category resolution for special UI achievements.
 * Uses achievementCategory when stored, else infers from achievementName slugs (legacy rows).
 */

import {
  EARLY_UNIVERSITY_EVENT_VALUES,
  ENTREPRENEURSHIP_EVENT_VALUES,
  TRAINING_MODE_VALUES,
  UI_CATEGORY_EARLY_UNIVERSITY,
  UI_CATEGORY_ENTREPRENEURSHIP,
  UI_CATEGORY_TRAINING_COURSES,
} from "@/constants/achievement-special-categories";
import {
  ENTREPRENEURSHIP_META_BLOCK_CLOSE,
  ENTREPRENEURSHIP_META_BLOCK_OPEN,
  inferUiCategoryFromStoredAchievement,
} from "@/lib/achievement-special-category-rules";
import { REPORT_CATEGORY_VALUES } from "@/lib/report-filter-options";

export const VIRTUAL_REPORT_CATEGORY_VALUES = [
  UI_CATEGORY_EARLY_UNIVERSITY,
  UI_CATEGORY_ENTREPRENEURSHIP,
  UI_CATEGORY_TRAINING_COURSES,
] as const;

const VIRTUAL_SET = new Set<string>(VIRTUAL_REPORT_CATEGORY_VALUES);

/** Same allowlist as `REPORT_CATEGORY_VALUES` (includes virtual categories). */
export const EXTENDED_REPORT_CATEGORY_VALUES = REPORT_CATEGORY_VALUES;

export const EXTENDED_REPORT_CATEGORY_SET = new Set<string>([...REPORT_CATEGORY_VALUES]);

export type AchievementDocLike = {
  achievementType?: string;
  achievementCategory?: string;
  achievementName?: string;
  description?: string;
};

const slugList = (set: ReadonlySet<string>) => [...set];

/** Canonical report/filter category key for one achievement row. */
export const resolveStoredAchievementReportCategory = (
  doc: AchievementDocLike
): string => {
  const stored = String(doc.achievementCategory || "").trim();
  if (stored && EXTENDED_REPORT_CATEGORY_SET.has(stored)) return stored;

  const inferred = inferUiCategoryFromStoredAchievement({
    achievementType: String(doc.achievementType || ""),
    achievementName: doc.achievementName,
    achievementCategory: stored,
    description: doc.description,
  });
  if (inferred) return inferred;

  const type = String(doc.achievementType || "").trim();
  if (type && EXTENDED_REPORT_CATEGORY_SET.has(type)) return type;
  return stored || type || "other";
};

export type SpecialAchievementHighlightBadge = {
  key: "early_university" | "entrepreneurship";
  labelAr: string;
  labelEn: string;
};

/** Optional highlight badge for Hall of Fame / public portfolio (non-breaking). */
export const getSpecialAchievementHighlightBadge = (
  doc: AchievementDocLike
): SpecialAchievementHighlightBadge | null => {
  const cat = resolveStoredAchievementReportCategory(doc);
  if (cat === UI_CATEGORY_EARLY_UNIVERSITY) {
    return {
      key: "early_university",
      labelAr: "قبول جامعي مبكر",
      labelEn: "Early university admission",
    };
  }
  if (cat === UI_CATEGORY_ENTREPRENEURSHIP) {
    return {
      key: "entrepreneurship",
      labelAr: "ريادة أعمال",
      labelEn: "Entrepreneurship",
    };
  }
  return null;
};

/** Mongo $or branches for filtering by report categories (legacy + virtual). */
export const buildReportCategoriesMongoFilter = (
  categories: string[]
): Record<string, unknown> | null => {
  const normalized = categories
    .map((c) => String(c || "").trim())
    .filter((c) => EXTENDED_REPORT_CATEGORY_SET.has(c));
  if (normalized.length === 0) return null;

  const legacy = normalized.filter((c) => !VIRTUAL_SET.has(c));
  const virtual = normalized.filter((c) => VIRTUAL_SET.has(c));

  const or: Record<string, unknown>[] = [];

  if (legacy.length > 0) {
    or.push(
      { achievementCategory: { $in: legacy } },
      { achievementType: { $in: legacy } }
    );
  }

  for (const v of virtual) {
    if (v === UI_CATEGORY_EARLY_UNIVERSITY) {
      or.push(
        { achievementCategory: UI_CATEGORY_EARLY_UNIVERSITY },
        { achievementName: { $in: slugList(EARLY_UNIVERSITY_EVENT_VALUES) } }
      );
    } else if (v === UI_CATEGORY_ENTREPRENEURSHIP) {
      or.push(
        { achievementCategory: UI_CATEGORY_ENTREPRENEURSHIP },
        { achievementName: { $in: slugList(ENTREPRENEURSHIP_EVENT_VALUES) } },
        {
          description: {
            $regex: String.raw`(\[ENTREPRENEURSHIP_META\]|__TAMIZ_ENT__)`,
          },
        }
      );
    } else if (v === UI_CATEGORY_TRAINING_COURSES) {
      or.push(
        { achievementCategory: UI_CATEGORY_TRAINING_COURSES },
        { achievementName: { $in: slugList(TRAINING_MODE_VALUES) } }
      );
    }
  }

  if (or.length === 0) return null;
  if (or.length === 1) return or[0];
  return { $or: or };
};

export const matchesReportCategoryFilter = (
  doc: AchievementDocLike,
  filterCategory: string
): boolean => {
  const f = String(filterCategory || "").trim();
  if (!f || f === "all") return true;
  if (!EXTENDED_REPORT_CATEGORY_SET.has(f)) return false;
  return resolveStoredAchievementReportCategory(doc) === f;
};

export const stripEntrepreneurshipMetaFromDescription = (description: string): string => {
  const raw = String(description || "");
  const open = raw.indexOf(ENTREPRENEURSHIP_META_BLOCK_OPEN);
  if (open >= 0) {
    const close = raw.indexOf(ENTREPRENEURSHIP_META_BLOCK_CLOSE, open);
    if (close >= 0) {
      return `${raw.slice(0, open)}${raw.slice(close + ENTREPRENEURSHIP_META_BLOCK_CLOSE.length)}`.trim();
    }
    return raw.slice(0, open).trim();
  }
  const legacy = raw.indexOf("__TAMIZ_ENT__");
  if (legacy >= 0) return raw.slice(0, legacy).trim();
  return raw.trim();
};
