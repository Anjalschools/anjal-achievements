/**
 * Metadata-driven competition & program eligibility — no per-competition if-chains in engines.
 */

import type { CompetitionTableType } from "@/lib/competitions/table-presets";

export type EligibilityStage = "primary" | "middle" | "secondary";

export type EligibilityProgram = "arabic" | "international" | "any";

export type PathwayTag =
  | "math"
  | "science"
  | "informatics"
  | "research"
  | "language"
  | "standardized_test"
  | "gifted"
  | "olympiad"
  | "international_track";

export type CompetitionEligibilityConfig = {
  key: string;
  titleAr: string;
  titleEn: string;
  competitionType: CompetitionTableType;
  /** Inclusive grade numbers 1–12 */
  minGrade: number;
  maxGrade: number;
  allowedGrades: number[];
  allowedStages: EligibilityStage[];
  allowedPrograms: EligibilityProgram[];
  /** Explicit blocks (e.g. g12 for nasmo) */
  blockedGrades?: number[];
  requiresInternational?: boolean;
  requiresMawhiba?: boolean;
  pathwayTags: PathwayTag[];
  /** When student is below min grade — suggest as future track */
  futureWindow?: { minGrade: number; maxGrade: number };
  /** Keys of competitions that strengthen readiness for this one */
  readinessSignals?: string[];
  /** Keys to deprioritize when this is a strong match */
  deprioritizeWhenStrong?: string[];
};

const grades = (...nums: number[]): number[] => nums;

const cfg = (partial: CompetitionEligibilityConfig): CompetitionEligibilityConfig => partial;

/** Registry — extend by adding entries only */
export const COMPETITION_ELIGIBILITY_REGISTRY: CompetitionEligibilityConfig[] = [
  cfg({
    key: "nasmo",
    titleAr: "نسمو",
    titleEn: "Nasmo",
    competitionType: "olympiad_stages",
    minGrade: 7,
    maxGrade: 11,
    allowedGrades: grades(7, 8, 9, 10, 11),
    allowedStages: ["middle", "secondary"],
    blockedGrades: grades(1, 2, 3, 4, 5, 6, 12),
    allowedPrograms: ["any"],
    pathwayTags: ["gifted", "olympiad", "science"],
    futureWindow: { minGrade: 7, maxGrade: 11 },
    readinessSignals: ["kangaroo", "bebras", "mawhiba_discovery"],
    deprioritizeWhenStrong: ["qiyas", "sat", "misk", "srsi"],
  }),
  cfg({
    key: "bebras",
    titleAr: "بيبراس",
    titleEn: "Bebras",
    competitionType: "medals",
    minGrade: 3,
    maxGrade: 12,
    allowedGrades: grades(3, 4, 5, 6, 7, 8, 9, 10, 11, 12),
    allowedStages: ["primary", "middle", "secondary"],
    allowedPrograms: ["any"],
    pathwayTags: ["informatics", "math"],
    readinessSignals: [],
  }),
  cfg({
    key: "kangaroo",
    titleAr: "كانجارو",
    titleEn: "Kangaroo",
    competitionType: "medals",
    minGrade: 3,
    maxGrade: 12,
    allowedGrades: grades(3, 4, 5, 6, 7, 8, 9, 10, 11, 12),
    allowedStages: ["primary", "middle", "secondary"],
    allowedPrograms: ["any"],
    pathwayTags: ["math"],
    readinessSignals: ["bebras"],
  }),
  cfg({
    key: "kaust_math",
    titleAr: "كاوست رياضيات",
    titleEn: "KAUST Mathematics",
    competitionType: "medals",
    minGrade: 7,
    maxGrade: 12,
    allowedGrades: grades(7, 8, 9, 10, 11, 12),
    allowedStages: ["middle", "secondary"],
    blockedGrades: grades(1, 2, 3, 4, 5, 6),
    allowedPrograms: ["any"],
    pathwayTags: ["math", "olympiad"],
    futureWindow: { minGrade: 7, maxGrade: 12 },
    readinessSignals: ["kangaroo", "bebras"],
    deprioritizeWhenStrong: ["qiyas", "sat"],
  }),
  cfg({
    key: "misk",
    titleAr: "مسك",
    titleEn: "Misk",
    competitionType: "acceptance",
    minGrade: 10,
    maxGrade: 10,
    allowedGrades: grades(10),
    allowedStages: ["secondary"],
    allowedPrograms: ["any"],
    pathwayTags: ["gifted"],
    readinessSignals: ["mawhiba_discovery", "nasmo"],
    deprioritizeWhenStrong: ["bebras", "kangaroo"],
  }),
  cfg({
    key: "srsi",
    titleAr: "SRSI",
    titleEn: "SRSI",
    competitionType: "acceptance",
    minGrade: 11,
    maxGrade: 11,
    allowedGrades: grades(11),
    allowedStages: ["secondary"],
    allowedPrograms: ["any"],
    pathwayTags: ["research", "science"],
    futureWindow: { minGrade: 11, maxGrade: 11 },
    readinessSignals: ["ibdaa", "mawhiba_discovery"],
    deprioritizeWhenStrong: ["bebras", "kangaroo"],
  }),
  cfg({
    key: "ibdaa",
    titleAr: "الأولمبياد الوطني للإبداع العلمي",
    titleEn: "National Science Creativity Olympiad",
    competitionType: "nominations",
    minGrade: 7,
    maxGrade: 12,
    allowedGrades: grades(7, 8, 9, 10, 11, 12),
    allowedStages: ["middle", "secondary"],
    blockedGrades: grades(1, 2, 3, 4, 5, 6),
    allowedPrograms: ["any"],
    pathwayTags: ["science", "research", "olympiad"],
    readinessSignals: ["mawhiba_discovery", "kangaroo"],
    deprioritizeWhenStrong: ["qiyas"],
  }),
  cfg({
    key: "qiyas",
    titleAr: "القدرات / التحصيلي",
    titleEn: "Qiyas / Tahsili",
    competitionType: "score_bands",
    minGrade: 11,
    maxGrade: 12,
    allowedGrades: grades(11, 12),
    allowedStages: ["secondary"],
    blockedGrades: grades(1, 2, 3, 4, 5, 6, 7, 8, 9, 10),
    allowedPrograms: ["any"],
    pathwayTags: ["standardized_test"],
    readinessSignals: [],
    deprioritizeWhenStrong: ["bebras", "kangaroo", "kaust_math"],
  }),
  cfg({
    key: "sat",
    titleAr: "SAT",
    titleEn: "SAT",
    competitionType: "score_bands",
    minGrade: 9,
    maxGrade: 12,
    allowedGrades: grades(9, 10, 11, 12),
    allowedStages: ["middle", "secondary"],
    allowedPrograms: ["international", "any"],
    requiresInternational: false,
    pathwayTags: ["standardized_test", "international_track", "language"],
    readinessSignals: ["ielts"],
    deprioritizeWhenStrong: [],
  }),
  cfg({
    key: "ielts",
    titleAr: "IELTS",
    titleEn: "IELTS",
    competitionType: "score_bands",
    minGrade: 9,
    maxGrade: 12,
    allowedGrades: grades(9, 10, 11, 12),
    allowedStages: ["middle", "secondary"],
    allowedPrograms: ["international", "any"],
    pathwayTags: ["language", "international_track"],
  }),
  cfg({
    key: "mawhiba_discovery",
    titleAr: "الكشف عن الموهوبين",
    titleEn: "Gifted discovery",
    competitionType: "olympiad_stages",
    minGrade: 3,
    maxGrade: 10,
    allowedGrades: grades(3, 4, 5, 6, 7, 8, 9, 10),
    allowedStages: ["primary", "middle", "secondary"],
    blockedGrades: grades(11, 12),
    allowedPrograms: ["any"],
    pathwayTags: ["gifted"],
    futureWindow: { minGrade: 3, maxGrade: 10 },
    readinessSignals: [],
  }),
  cfg({
    key: "olympiad_training",
    titleAr: "ملتقيات الأولمبياد",
    titleEn: "Olympiad training forums",
    competitionType: "olympiad_stages",
    minGrade: 7,
    maxGrade: 12,
    allowedGrades: grades(7, 8, 9, 10, 11, 12),
    allowedStages: ["middle", "secondary"],
    allowedPrograms: ["any"],
    pathwayTags: ["olympiad", "science", "math"],
    readinessSignals: ["mawhiba_discovery", "ibdaa"],
  }),
];

export const eligibilityConfigByKey = (key: string): CompetitionEligibilityConfig | undefined =>
  COMPETITION_ELIGIBILITY_REGISTRY.find((c) => c.key === key);

export const allEligibilityKeys = (): string[] =>
  COMPETITION_ELIGIBILITY_REGISTRY.map((c) => c.key);
