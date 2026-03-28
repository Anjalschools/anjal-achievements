/**
 * Record ↔ admin achievement edit sheet (review detail).
 * Display uses labels; PATCH body uses raw DB values only.
 */

import { normalizeAchievementNames } from "@/lib/achievementNormalize";
import { isLikelyTechnicalSlug, resolveAchievementEventSlug } from "@/lib/achievementDisplay";
import { getAchievementEventOrSlugLabel, humanizeRawKeyForDisplay } from "@/lib/achievement-display-labels";
import {
  mapDbAchievementTypeToUiCategory,
  getEventOptionsForUiCategory,
} from "@/constants/achievement-ui-categories";
import { EXHIBITION_OPTIONS } from "@/constants/achievement-options";

export type AdminEditLocale = "ar" | "en";

const pickResolved = (raw: string, loc: AdminEditLocale): string => {
  const t = raw.trim();
  if (!t) return "";
  if (!isLikelyTechnicalSlug(t)) return t;
  const hit = resolveAchievementEventSlug(t);
  if (hit) return loc === "ar" ? hit.ar : hit.en;
  const lbl = getAchievementEventOrSlugLabel(t, loc);
  if (lbl && lbl !== "—") return lbl;
  return humanizeRawKeyForDisplay(t, loc);
};

/**
 * Initial Arabic/English display names: never seed inputs with raw event slugs when a catalogue label exists.
 */
export const buildAdminAchievementEditInitialNames = (
  a: Record<string, unknown>
): { nameAr: string; nameEn: string } => {
  const names = normalizeAchievementNames(a);
  const achName = String(a.achievementName || "").trim();
  const custom = String(a.customAchievementName || "").trim();

  let nameAr = pickResolved(String(names.normalizedNameAr || a.nameAr || "").trim(), "ar");
  if (!nameAr && achName) nameAr = pickResolved(achName, "ar");
  if (!nameAr && custom && !isLikelyTechnicalSlug(custom)) nameAr = custom;
  if (!nameAr && achName) nameAr = humanizeRawKeyForDisplay(achName, "ar");

  let nameEn = pickResolved(String(names.normalizedNameEn || a.nameEn || "").trim(), "en");
  if (!nameEn && achName) nameEn = pickResolved(achName, "en");
  if (!nameEn && custom && !isLikelyTechnicalSlug(custom)) nameEn = custom;
  if (!nameEn && achName) nameEn = humanizeRawKeyForDisplay(achName, "en");

  return { nameAr, nameEn };
};

/** Dropdown options for event / program / exhibition slug (value = stored achievementName). */
export const getAdminAchievementEventSelectOptions = (
  dbAchievementType: string,
  loc: AdminEditLocale
): Array<{ value: string; label: string }> => {
  const t = String(dbAchievementType || "").trim();
  if (t === "exhibition") {
    return EXHIBITION_OPTIONS.map((o) => ({
      value: o.value,
      label: loc === "ar" ? o.ar : o.en,
    }));
  }
  const ui = mapDbAchievementTypeToUiCategory(t);
  if (ui === "other" && t !== "exhibition") {
    return [];
  }
  return getEventOptionsForUiCategory(ui, loc);
};

/** If current achievementName is not in the list, prepend a synthetic option so the select stays controlled. */
export const mergeUnknownEventOption = (
  options: Array<{ value: string; label: string }>,
  currentValue: string,
  loc: AdminEditLocale
): Array<{ value: string; label: string }> => {
  const v = String(currentValue || "").trim();
  if (!v) return options;
  if (options.some((o) => o.value === v)) return options;
  const label = pickResolved(v, loc) || humanizeRawKeyForDisplay(v, loc);
  return [{ value: v, label }, ...options];
};
