import {
  getAchievementDisplayName,
  isLikelyTechnicalSlug,
  labelInferredField,
  safeTrim,
} from "@/lib/achievementDisplay";

const UNKNOWN_KEY = "__unknown__";

export const prettifyAchievementSlug = (value: string): string => {
  const s = safeTrim(value);
  if (!s) return "";
  return s
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
};

const coalesceField = (record: Record<string, unknown>): string =>
  safeTrim(record.inferredField) || safeTrim(record.domain) || safeTrim(record.olympiadField);

export const getAchievementAdminFieldKey = (record: Record<string, unknown>): string => {
  const raw = coalesceField(record).toLowerCase().replace(/\s+/g, "_");
  return raw || UNKNOWN_KEY;
};

export const getAchievementAdminFieldLabel = (
  record: Record<string, unknown>,
  locale: "ar" | "en"
): string => {
  const raw = coalesceField(record);
  if (!raw) return locale === "ar" ? "غير محدد" : "Not specified";
  return labelInferredField(raw, locale);
};

const pickEventKey = (record: Record<string, unknown>): string =>
  safeTrim(record.achievementName) ||
  safeTrim(record.customAchievementName) ||
  safeTrim(record.nameAr) ||
  safeTrim(record.nameEn) ||
  safeTrim(record.title);

export const getAchievementAdminEventKey = (record: Record<string, unknown>): string => {
  const key = pickEventKey(record).toLowerCase().replace(/\s+/g, "_");
  return key || UNKNOWN_KEY;
};

export const getAchievementAdminEventLabel = (
  record: Record<string, unknown>,
  locale: "ar" | "en"
): string => {
  const rawDisplay = getAchievementDisplayName(record, locale);
  if (rawDisplay && !isLikelyTechnicalSlug(rawDisplay)) return rawDisplay;
  const key = pickEventKey(record);
  if (!key) return locale === "ar" ? "غير محدد" : "Not specified";
  return prettifyAchievementSlug(key) || (locale === "ar" ? "غير محدد" : "Not specified");
};
