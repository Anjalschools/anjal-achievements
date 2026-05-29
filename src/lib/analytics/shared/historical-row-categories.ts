/**
 * Shared historical row categories — dependency leaf.
 * Pure constants/types only (no engine imports).
 */

export type HistoricalRowCategory = {
  key: string;
  labelAr: string;
  labelEn: string;
  stage: "primary" | "middle" | "secondary" | "all";
  section: "arabic" | "international" | "all";
};

export const ROW_CATEGORIES: HistoricalRowCategory[] = [
  { key: "primary_ar", labelAr: "ابتدائي عربي", labelEn: "Primary Arabic", stage: "primary", section: "arabic" },
  { key: "middle_ar", labelAr: "متوسط عربي", labelEn: "Middle Arabic", stage: "middle", section: "arabic" },
  { key: "secondary_ar", labelAr: "ثانوي عربي", labelEn: "Secondary Arabic", stage: "secondary", section: "arabic" },
  { key: "primary_intl", labelAr: "ابتدائي دولي", labelEn: "Primary International", stage: "primary", section: "international" },
  { key: "middle_intl", labelAr: "متوسط دولي", labelEn: "Middle International", stage: "middle", section: "international" },
  { key: "secondary_intl", labelAr: "ثانوي دولي", labelEn: "Secondary International", stage: "secondary", section: "international" },
];

/** Matrix rows exclude activity total and scope rows. */
export const MATRIX_ROW_KEYS: HistoricalRowCategory[] = ROW_CATEGORIES.filter(
  (c) => c.key !== "activity_total" && !c.key.startsWith("scope_")
);

