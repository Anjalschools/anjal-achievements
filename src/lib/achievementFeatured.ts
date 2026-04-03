/**
 * Derived "featured / distinguished" achievement logic for stats and UI.
 */
export type AchievementRecordLike = Record<string, unknown> & {
  achievementLevel?: string;
  level?: string;
  achievementType?: string;
  achievementCategory?: string;
  featured?: boolean;
};

const normLevel = (r: AchievementRecordLike) =>
  String(r.achievementLevel || r.level || "").toLowerCase();

const uiFeaturedCategories = new Set([
  "qudrat",
  "mawhiba",
  "gifted_screening",
  "standardized_tests",
]);

export const isFeaturedAchievement = (record: AchievementRecordLike): boolean => {
  const lv = normLevel(record);
  if (lv === "kingdom" || lv === "international") return true;
  if (record.featured === true) return true;
  const cat = String(record.achievementCategory || "").toLowerCase();
  if (uiFeaturedCategories.has(cat)) return true;
  const t = String(record.achievementType || "").toLowerCase();
  if (
    ["qudrat", "mawhiba_annual", "gifted_discovery", "sat", "ielts", "toefl"].includes(t)
  )
    return true;
  return false;
};
