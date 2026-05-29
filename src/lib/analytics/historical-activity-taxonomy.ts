/**
 * Canonical historical activity taxonomy — aliases, typeKeys, multilingual matching.
 */

import type { HistoricalTableType } from "@/lib/analytics/historical-comparison-table-engine";
import type { AnalyticsTableThemeId } from "@/lib/analytics/analytics-table-theme-registry";

export type CanonicalActivityId =
  | "kangaroo"
  | "bebras"
  | "srsi"
  | "ibdaa"
  | "mawhiba_discovery"
  | "sat"
  | "ielts"
  | "olympiad_training";

export type HistoricalActivityTaxon = {
  id: CanonicalActivityId;
  labelAr: string;
  labelEn: string;
  tableType: HistoricalTableType;
  themeId: AnalyticsTableThemeId;
  /** Normalized typeKey values from participation pipeline */
  typeKeys: string[];
  /** Label / raw activity aliases */
  labelPatterns: RegExp[];
  /** Legacy slugs (URLs, old imports) */
  legacySlugs: string[];
};

export const HISTORICAL_ACTIVITY_TAXONOMY: HistoricalActivityTaxon[] = [
  {
    id: "kangaroo",
    labelAr: "كانجارو",
    labelEn: "Kangaroo",
    tableType: "medals",
    themeId: "competition",
    typeKeys: ["kangaroo", "competition"],
    labelPatterns: [/kangaroo|كانجارو|kangaroo[-_\s]?math|kangaroo[-_\s]?competition/i],
    legacySlugs: ["kangaroo_math", "kangaroo-2024", "kangaroo competition"],
  },
  {
    id: "bebras",
    labelAr: "بيبراس",
    labelEn: "Bebras",
    tableType: "medals",
    themeId: "competition",
    typeKeys: ["bebras", "competition"],
    labelPatterns: [/bebras|بيبراس|beaver|القندس/i],
    legacySlugs: ["bebras_challenge", "bebras-2024"],
  },
  {
    id: "srsi",
    labelAr: "SRSI",
    labelEn: "SRSI",
    tableType: "qualification_acceptance",
    themeId: "program",
    typeKeys: ["srsi", "program"],
    labelPatterns: [/srsi/i],
    legacySlugs: ["srsi_program"],
  },
  {
    id: "ibdaa",
    labelAr: "إبداع",
    labelEn: "Ibdaa",
    tableType: "qualification_acceptance",
    themeId: "olympiad",
    typeKeys: ["ibdaa", "isef", "olympiad"],
    labelPatterns: [/ibdaa|إبداع|isef|آيسف|science fair/i],
    legacySlugs: ["isef", "ibdaa_science"],
  },
  {
    id: "mawhiba_discovery",
    labelAr: "الكشف عن الموهوبين",
    labelEn: "Gifted discovery",
    tableType: "talent_discovery",
    themeId: "talent",
    typeKeys: ["mawhiba", "gifted", "talent"],
    labelPatterns: [/mawhiba|موهبة|gifted|موهوب|talent discovery/i],
    legacySlugs: ["mawhiba", "gifted_discovery"],
  },
  {
    id: "sat",
    labelAr: "SAT",
    labelEn: "SAT",
    tableType: "standardized_testing",
    themeId: "testing",
    typeKeys: ["sat", "standardized_test"],
    labelPatterns: [/\bsat\b|سات|scholastic aptitude/i],
    legacySlugs: ["sat_exam"],
  },
  {
    id: "ielts",
    labelAr: "IELTS",
    labelEn: "IELTS",
    tableType: "standardized_testing",
    themeId: "testing",
    typeKeys: ["ielts"],
    labelPatterns: [/ielts|آيلتس/i],
    legacySlugs: ["ielts_exam"],
  },
  {
    id: "olympiad_training",
    labelAr: "ملتقيات الأولمبياد",
    labelEn: "Olympiad training forums",
    tableType: "training_program",
    themeId: "olympiad",
    typeKeys: ["olympiad", "training"],
    labelPatterns: [/olympiad|أولمبياد|ملتقى|training forum|science olympiad/i],
    legacySlugs: ["olympiad_training"],
  },
];

export const taxonomyById = (id: CanonicalActivityId): HistoricalActivityTaxon | undefined =>
  HISTORICAL_ACTIVITY_TAXONOMY.find((t) => t.id === id);

export const normalizeActivitySlug = (raw: string): string =>
  raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^\w\u0600-\u06FF-]/g, "");
