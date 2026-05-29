import type { CompetitionTableType } from "@/lib/competitions/table-presets";
import {
  ACCEPTANCE_COLUMN_PRESET,
  MEDAL_COLUMN_PRESET,
  NOMINATION_COLUMN_PRESET,
  PLACEMENT_COLUMN_PRESET,
  buildScoreBandColumns,
  buildStageColumns,
  type CompetitionColumnDef,
} from "@/lib/competitions/table-presets";

export type CompetitionConfig = {
  key: string;
  type: CompetitionTableType;
  titleAr: string;
  titleEn: string;
  /** Registry / taxonomy id */
  taxonomyId?: string;
  medalBased?: boolean;
  /** Restrict rows to specific grades (e.g. Misk first secondary) */
  gradeFilter?: string[];
  resolveColumns: (year: number) => CompetitionColumnDef[];
};

const OLYMPIAD_LEGACY_STAGES = [
  { key: "mawhiba", labelAr: "موهوب", labelEn: "Mawhiba" },
  { key: "winter_forum", labelAr: "ملتقى الشتاء", labelEn: "Winter forum" },
  { key: "spring_forum", labelAr: "ملتقى الربيع", labelEn: "Spring forum" },
  { key: "summer_forum", labelAr: "ملتقى الصيف", labelEn: "Summer forum" },
  { key: "autumn_forum", labelAr: "ملتقى الخريف", labelEn: "Autumn forum" },
  { key: "elite_forum", labelAr: "ملتقى النخبة", labelEn: "Elite forum" },
];

const OLYMPIAD_NASMO_STAGES = [
  { key: "nasmo_1", labelAr: "نسمو المرحلة الأولى", labelEn: "Nasmo stage 1" },
  { key: "nasmo_2", labelAr: "نسمو المرحلة الثانية", labelEn: "Nasmo stage 2" },
  { key: "nasmo_3", labelAr: "نسمو المرحلة الثالثة", labelEn: "Nasmo stage 3" },
  { key: "nasmo_4", labelAr: "نسمو المرحلة الرابعة", labelEn: "Nasmo stage 4" },
  { key: "summer_forum", labelAr: "ملتقى الصيف", labelEn: "Summer forum" },
  { key: "winter_forum", labelAr: "ملتقى الشتاء", labelEn: "Winter forum" },
  { key: "spring_forum", labelAr: "ملتقى الربيع", labelEn: "Spring forum" },
  { key: "autumn_forum", labelAr: "ملتقى الخريف", labelEn: "Autumn forum" },
  { key: "elite_forum", labelAr: "ملتقى النخبة", labelEn: "Elite forum" },
];

const QIYAS_BANDS = ["100", "99", "98", "97", "96", "95", "lessThan95"];

const config = (
  partial: Omit<CompetitionConfig, "resolveColumns"> & {
    columns?: CompetitionColumnDef[];
    columnsForYear?: (year: number) => CompetitionColumnDef[];
  }
): CompetitionConfig => ({
  ...partial,
  resolveColumns: (year) =>
    partial.columnsForYear ? partial.columnsForYear(year) : (partial.columns ?? MEDAL_COLUMN_PRESET),
});

export const BEBRAS_CONFIG: CompetitionConfig = config({
  key: "bebras",
  type: "medals",
  titleAr: "بيبراس",
  titleEn: "Bebras",
  taxonomyId: "bebras",
  medalBased: true,
  columns: MEDAL_COLUMN_PRESET,
});

export const KANGAROO_CONFIG: CompetitionConfig = config({
  key: "kangaroo",
  type: "medals",
  titleAr: "كانجارو",
  titleEn: "Kangaroo",
  taxonomyId: "kangaroo",
  medalBased: true,
  columns: MEDAL_COLUMN_PRESET,
});

export const IBdaa_CONFIG: CompetitionConfig = config({
  key: "ibdaa",
  type: "nominations",
  titleAr: "إبداع",
  titleEn: "Ibdaa",
  taxonomyId: "ibdaa",
  columns: NOMINATION_COLUMN_PRESET,
});

export const MISK_CONFIG: CompetitionConfig = config({
  key: "misk",
  type: "acceptance",
  titleAr: "مسك",
  titleEn: "Misk",
  columns: ACCEPTANCE_COLUMN_PRESET,
  gradeFilter: ["g10", "10", "اول ثانوي", "الأول الثانوي"],
});

export const SRSI_CONFIG: CompetitionConfig = config({
  key: "srsi",
  type: "acceptance",
  titleAr: "SRSI",
  titleEn: "SRSI",
  taxonomyId: "srsi",
  columns: ACCEPTANCE_COLUMN_PRESET,
});

export const MAWHIBA_OLYMPIAD_CONFIG: CompetitionConfig = config({
  key: "mawhiba_discovery",
  type: "olympiad_stages",
  titleAr: "الكشف عن الموهوبين",
  titleEn: "Gifted discovery",
  taxonomyId: "mawhiba_discovery",
  columnsForYear: (year) =>
    buildStageColumns(year >= 2026 ? OLYMPIAD_NASMO_STAGES : OLYMPIAD_LEGACY_STAGES),
});

export const OLYMPIAD_TRAINING_CONFIG: CompetitionConfig = config({
  key: "olympiad_training",
  type: "olympiad_stages",
  titleAr: "ملتقيات الأولمبياد",
  titleEn: "Olympiad training forums",
  taxonomyId: "olympiad_training",
  columnsForYear: (year) =>
    buildStageColumns(year >= 2026 ? OLYMPIAD_NASMO_STAGES : OLYMPIAD_LEGACY_STAGES),
});

export const QIYAS_CONFIG: CompetitionConfig = config({
  key: "qiyas",
  type: "score_bands",
  titleAr: "قدرات / تحصيلي",
  titleEn: "Qiyas / Tahsili",
  columns: buildScoreBandColumns(QIYAS_BANDS),
});

export const COMPETITION_CONFIGS: CompetitionConfig[] = [
  BEBRAS_CONFIG,
  KANGAROO_CONFIG,
  IBdaa_CONFIG,
  MISK_CONFIG,
  SRSI_CONFIG,
  MAWHIBA_OLYMPIAD_CONFIG,
  OLYMPIAD_TRAINING_CONFIG,
  QIYAS_CONFIG,
];

export const competitionConfigByKey = (key: string): CompetitionConfig | undefined =>
  COMPETITION_CONFIGS.find((c) => c.key === key);

export const competitionConfigByTaxonomy = (taxonomyId: string): CompetitionConfig | undefined =>
  COMPETITION_CONFIGS.find((c) => c.taxonomyId === taxonomyId || c.key === taxonomyId);
