/**
 * UI achievement categories. Maps to DB achievementType via mapUiCategoryToDbAchievementType.
 */

import { getAchievementNamesByType, QUDRAT_TIER_OPTIONS } from "@/constants/achievement-options";

export type UiAchievementCategory =
  | "competition"
  | "program"
  | "olympiad"
  | "excellence_program"
  | "standardized_tests"
  | "other";

export const UI_CATEGORY_OPTIONS: ReadonlyArray<{
  value: UiAchievementCategory;
  ar: string;
  en: string;
}> = [
  { value: "competition", ar: "مسابقة", en: "Competition" },
  { value: "program", ar: "برنامج", en: "Program" },
  { value: "olympiad", ar: "أولمبياد", en: "Olympiad" },
  { value: "excellence_program", ar: "برنامج تميز", en: "Excellence Program" },
  { value: "standardized_tests", ar: "الاختبارات المعيارية", en: "Standardized tests" },
  { value: "other", ar: "آخر", en: "Other" },
] as const;

/** Picker under «الاختبارات المعيارية» — values are DB `achievementType`. */
export const STANDARDIZED_TEST_TYPE_OPTIONS: ReadonlyArray<{
  value: string;
  ar: string;
  en: string;
}> = [
  { value: "qudrat", ar: "اختبار قدرات", en: "Qudrat test" },
  { value: "mawhiba_annual", ar: "اختبار موهبة السنوي", en: "Mawhiba annual test" },
  { value: "gifted_discovery", ar: "اختبار الكشف عن الموهوبين", en: "Gifted screening test" },
  { value: "sat", ar: "اختبار SAT", en: "SAT" },
  { value: "ielts", ar: "اختبار IELTS", en: "IELTS" },
  { value: "toefl", ar: "اختبار TOEFL", en: "TOEFL" },
] as const;

export const STANDARDIZED_TESTS_DB_TYPES = new Set([
  "qudrat",
  "mawhiba_annual",
  "gifted_discovery",
  "sat",
  "ielts",
  "toefl",
]);

export const OLYMPIAD_EVENT_OTHER_VALUE = "olympiad_other" as const;

export const OLYMPIAD_UI_EVENT_OPTIONS = [
  { value: "winter_camp", ar: "ملتقى الشتاء", en: "Winter Camp" },
  { value: "spring_camp", ar: "ملتقى الربيع", en: "Spring Camp" },
  { value: "summer_camp", ar: "ملتقى الصيف", en: "Summer Camp" },
  { value: "alnukhba_camp", ar: "ملتقى النخبة", en: "Alnukhba Camp" },
  { value: "nesmo_stage_1", ar: "نسمو المرحلة الأولى", en: "Nesmo Stage 1" },
  { value: "nesmo_stage_2", ar: "نسمو المرحلة الثانية", en: "Nesmo Stage 2" },
  { value: "nesmo_stage_3", ar: "نسمو المرحلة الثالثة", en: "Nesmo Stage 3" },
  { value: OLYMPIAD_EVENT_OTHER_VALUE, ar: "آخر", en: "Other" },
] as const;

/** Qudrat percent tiers (certificates, labels) — single source: achievement-options */
export const QUDRAT_EVENT_OPTIONS = QUDRAT_TIER_OPTIONS;

export const getAutoLevelForOlympiadNesmoEvent = (
  eventValue: string | null | undefined
): string | null => {
  switch (eventValue) {
    case "winter_camp":
    case "spring_camp":
    case "summer_camp":
    case "alnukhba_camp":
      return "kingdom";

    case "nesmo_stage_1":
    case "nesmo_stage_2":
      return "province";

    case "nesmo_stage_3":
      return "kingdom";

    default:
      return null;
  }
};

export const getAutoLockedLevelByCategory = (
  uiCategory: string | null | undefined
): string | null => {
  switch (uiCategory) {
    default:
      return null;
  }
};

export const getMawhibaAnnualSubjectOptionsForCategory = <
  T extends { value: string }
>(
  uiCategory: string | null | undefined,
  options: readonly T[]
): T[] => {
  if (uiCategory === "mawhiba" || uiCategory === "standardized_tests") {
    return options.filter((item) => item.value !== "full_test");
  }
  return [...options];
};

export const mapUiCategoryToDbAchievementType = (ui: string): string => {
  switch (ui) {
    case "mawhiba":
      return "mawhiba_annual";
    case "gifted_screening":
      return "gifted_discovery";
    case "standardized_tests":
      return "";
    case "competition":
    case "program":
    case "olympiad":
    case "excellence_program":
    case "qudrat":
    case "other":
      return ui;
    default:
      return "other";
  }
};

export const mapUiCategoryToNamesListType = (ui: string): string => {
  if (ui === "mawhiba") return "mawhiba_annual";
  if (ui === "gifted_screening") return "gifted_discovery";
  if (ui === "qudrat") return "qudrat";
  if (ui === "standardized_tests") return "other";

  if (
    ui === "competition" ||
    ui === "program" ||
    ui === "olympiad" ||
    ui === "excellence_program"
  ) {
    return ui;
  }

  return "other";
};

export const getEventOptionsForUiCategory = (
  ui: string,
  locale: "ar" | "en"
): Array<{ value: string; label: string }> => {
  if (!ui || ui === "other") return [];

  if (ui === "olympiad") {
    return OLYMPIAD_UI_EVENT_OPTIONS.map((o) => ({
      value: o.value,
      label: locale === "ar" ? o.ar : o.en,
    }));
  }

  if (ui === "qudrat") {
    return QUDRAT_EVENT_OPTIONS.map((o) => ({
      value: o.value,
      label: locale === "ar" ? o.ar : o.en,
    }));
  }

  if (ui === "standardized_tests") {
    return [];
  }

  const namesType = mapUiCategoryToNamesListType(ui);
  return getAchievementNamesByType(namesType).map((item) => ({
    value: item.value,
    label: locale === "ar" ? item.ar : item.en,
  }));
};

export const mapDbAchievementTypeToUiCategory = (
  dbType: string
): UiAchievementCategory => {
  switch (dbType) {
    case "mawhiba_annual":
    case "gifted_discovery":
    case "qudrat":
    case "sat":
    case "ielts":
    case "toefl":
      return "standardized_tests";
    case "competition":
      return "competition";
    case "program":
      return "program";
    case "olympiad":
      return "olympiad";
    case "excellence_program":
      return "excellence_program";
    case "exhibition":
      return "other";
    default:
      return "other";
  }
};

/** UI category shown in the form: legacy rows may store old `achievementCategory` (qudrat, mawhiba, …). */
export const resolveAchievementFormUiCategory = (
  dbType: string,
  storedCategory: string | undefined
): UiAchievementCategory => {
  const fromType = mapDbAchievementTypeToUiCategory(dbType);
  if (fromType === "standardized_tests") return "standardized_tests";
  const s = String(storedCategory || "").trim();
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
    s === "excellence_program" ||
    s === "other"
  ) {
    return s as UiAchievementCategory;
  }
  return fromType;
};