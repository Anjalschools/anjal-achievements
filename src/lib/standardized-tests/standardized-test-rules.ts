/**
 * Structured standardized test scoring — rules, validation, and display.
 * Backward compatible: infers from legacy fields when `standardizedTest` is absent.
 */

import { normalizeLegacyQudratAchievementName } from "@/lib/achievementNormalize";

export type StandardizedTestType =
  | "qudrat"
  | "tahsili"
  | "sat"
  | "ielts"
  | "toefl"
  | "step"
  | "act"
  | "mawhiba"
  | "mawhiba_annual"
  | "gifted_discovery"
  | "gifted_screening"
  | "qiyas"
  | "language_test"
  | "other";

export type StandardizedScoreScale =
  | "band"
  | "percentage"
  | "points"
  | "raw"
  | "rank"
  | "participation";

export type StandardizedTestMetadata = {
  testType: StandardizedTestType;
  rawScore: number;
  normalizedScore?: number;
  percentile?: number;
  bandScore?: number;
  scoreScale: StandardizedScoreScale;
  scoreLabel: string;
};

export type StandardizedTestInput = {
  achievementType?: string;
  achievementCategory?: string;
  achievementName?: string;
  resultType?: string;
  resultValue?: string;
  qudratScore?: string;
  giftedDiscoveryScore?: number;
  score?: number;
  standardizedTest?: StandardizedTestMetadata | Record<string, unknown> | null;
};

export type StandardizedScoreDisplay = {
  testType: StandardizedTestType;
  displayAr: string;
  displayEn: string;
  rawScore: number | null;
  scoreScale: StandardizedScoreScale;
  scoreLabel: string;
  isValid: boolean;
};

const DB_STANDARDIZED_TYPES = new Set<string>([
  "qudrat",
  "sat",
  "ielts",
  "toefl",
  "mawhiba_annual",
  "gifted_discovery",
]);

const TAHSILI_ALIASES = ["tahsili", "tahseeli", "تحصيلي", "التحصيلي", "tahsili_test"];
const STEP_ALIASES = ["step", "ستيب"];
const ACT_ALIASES = ["act"];
const QIYAS_ALIASES = ["qiyas", "قياس"];

const safeTrim = (v: unknown): string => String(v ?? "").trim();

const parseNum = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = safeTrim(v).replace(/%/g, "").replace(/,/g, ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

export const inferScoreScale = (testType: StandardizedTestType): StandardizedScoreScale => {
  switch (testType) {
    case "ielts":
      return "band";
    case "qudrat":
    case "tahsili":
    case "step":
      return "percentage";
    case "sat":
    case "toefl":
    case "act":
    case "gifted_discovery":
      return "points";
    case "mawhiba":
    case "mawhiba_annual":
      return "rank";
    default:
      return "raw";
  }
};

export const resolveStandardizedTestType = (input: StandardizedTestInput): StandardizedTestType | null => {
  const stored = input.standardizedTest as StandardizedTestMetadata | undefined;
  if (stored?.testType) return stored.testType;

  const t = safeTrim(input.achievementType).toLowerCase();
  if (DB_STANDARDIZED_TYPES.has(t)) {
    if (t === "mawhiba_annual") return "mawhiba_annual";
    if (t === "gifted_discovery") return "gifted_discovery";
    return t as StandardizedTestType;
  }

  const name = safeTrim(input.achievementName).toLowerCase();
  const cat = safeTrim(input.achievementCategory).toLowerCase();
  if (cat === "standardized_tests" || cat === "qudrat" || cat === "gifted_screening") {
    if (name.includes("qudrat") || t === "qudrat") return "qudrat";
    if (TAHSILI_ALIASES.some((a) => name.includes(a))) return "tahsili";
    if (name === "sat" || name.includes("sat")) return "sat";
    if (name === "ielts" || name.includes("ielts")) return "ielts";
    if (name === "toefl" || name.includes("toefl")) return "toefl";
    if (STEP_ALIASES.some((a) => name.includes(a))) return "step";
    if (ACT_ALIASES.some((a) => name === a || name.includes("act"))) return "act";
    if (QIYAS_ALIASES.some((a) => name.includes(a))) return "qiyas";
  }

  if (TAHSILI_ALIASES.some((a) => name.includes(a))) return "tahsili";
  if (STEP_ALIASES.some((a) => name.includes(a))) return "step";
  if (name === "sat") return "sat";
  if (name === "ielts") return "ielts";
  if (name === "toefl") return "toefl";

  return null;
};

const extractQudratPercent = (input: StandardizedTestInput): number | null => {
  const tier = normalizeLegacyQudratAchievementName(input.achievementName);
  const m = tier.match(/^qudrat_(\d{2,3})$/);
  if (m) return Number(m[1]);
  const qs = parseNum(input.qudratScore);
  if (qs != null && qs >= 0 && qs <= 100) return qs;
  const rv = parseNum(input.resultValue);
  if (rv != null && rv >= 0 && rv <= 100) return rv;
  return null;
};

const extractScoreFromInput = (
  testType: StandardizedTestType,
  input: StandardizedTestInput
): number | null => {
  const stored = input.standardizedTest as StandardizedTestMetadata | undefined;
  if (stored && typeof stored.rawScore === "number" && Number.isFinite(stored.rawScore)) {
    return stored.rawScore;
  }

  if (testType === "qudrat" || testType === "tahsili") {
    return extractQudratPercent(input);
  }

  if (testType === "gifted_discovery") {
    const g = input.giftedDiscoveryScore;
    if (typeof g === "number" && Number.isFinite(g)) return g;
    return parseNum(input.resultValue);
  }

  const rv = parseNum(input.resultValue);
  if (rv != null) return rv;

  return null;
};

export type NormalizeScoreResult = {
  rawScore: number;
  normalizedScore?: number;
  bandScore?: number;
  percentile?: number;
  scoreScale: StandardizedScoreScale;
  scoreLabel: string;
  isValid: boolean;
  errors: string[];
};

export const normalizeStandardizedTestScore = (
  testType: StandardizedTestType,
  raw: number | string | null | undefined
): NormalizeScoreResult => {
  const scale = inferScoreScale(testType);
  const errors: string[] = [];
  const n = typeof raw === "number" ? raw : parseNum(raw);

  if (n == null) {
    return {
      rawScore: 0,
      scoreScale: scale,
      scoreLabel: "",
      isValid: false,
      errors: ["missing_score"],
    };
  }

  let isValid = true;
  let bandScore: number | undefined;
  let normalizedScore: number | undefined = n;
  let scoreLabel = String(n);

  switch (testType) {
    case "ielts": {
      const v = Math.round(n * 2) / 2;
      if (v < 0 || v > 9) {
        isValid = false;
        errors.push("ielts_out_of_range");
      }
      bandScore = v;
      normalizedScore = v;
      scoreLabel = v % 1 === 0 ? String(v) : v.toFixed(1);
      break;
    }
    case "sat": {
      const v = Math.round(n);
      if (v < 400 || v > 1600) {
        isValid = false;
        errors.push("sat_out_of_range");
      }
      normalizedScore = v;
      scoreLabel = String(v);
      break;
    }
    case "toefl": {
      const v = Math.round(n);
      if (v < 0 || v > 120) {
        isValid = false;
        errors.push("toefl_out_of_range");
      }
      normalizedScore = v;
      scoreLabel = String(v);
      break;
    }
    case "act": {
      const v = Math.round(n);
      if (v < 1 || v > 36) {
        isValid = false;
        errors.push("act_out_of_range");
      }
      normalizedScore = v;
      scoreLabel = String(v);
      break;
    }
    case "qudrat":
    case "tahsili":
    case "step": {
      let pct = n;
      if (pct > 0 && pct <= 1) pct = pct * 100;
      const v = Math.round(pct);
      if (v < 0 || v > 100) {
        isValid = false;
        errors.push("percentage_out_of_range");
      }
      normalizedScore = v;
      scoreLabel = `${v}%`;
      break;
    }
    case "gifted_discovery": {
      const v = Math.round(n);
      if (v <= 1600) {
        isValid = false;
        errors.push("gifted_score_too_low");
      }
      normalizedScore = v;
      scoreLabel = String(v);
      break;
    }
    default:
      normalizedScore = n;
      scoreLabel = String(n);
  }

  return {
    rawScore: normalizedScore ?? n,
    normalizedScore,
    bandScore,
    scoreScale: scale,
    scoreLabel,
    isValid,
    errors,
  };
};

export const validateStandardizedTestResult = (
  testType: StandardizedTestType,
  input: StandardizedTestInput
): NormalizeScoreResult => {
  const raw = extractScoreFromInput(testType, input);
  return normalizeStandardizedTestScore(testType, raw);
};

export const buildStandardizedTestMetadata = (
  input: StandardizedTestInput
): StandardizedTestMetadata | null => {
  const testType = resolveStandardizedTestType(input);
  if (!testType) return null;

  const validated = validateStandardizedTestResult(testType, input);
  if (!validated.isValid && validated.errors.includes("missing_score")) {
    if (testType === "qudrat") {
      return null;
    }
    return null;
  }

  return {
    testType,
    rawScore: validated.rawScore,
    normalizedScore: validated.normalizedScore,
    bandScore: validated.bandScore,
    percentile: validated.percentile,
    scoreScale: validated.scoreScale,
    scoreLabel: validated.scoreLabel,
  };
};

const TEST_LABELS: Record<StandardizedTestType, { ar: string; en: string }> = {
  qudrat: { ar: "القدرات", en: "Qudrat" },
  tahsili: { ar: "التحصيلي", en: "Tahsili" },
  sat: { ar: "SAT", en: "SAT" },
  ielts: { ar: "IELTS", en: "IELTS" },
  toefl: { ar: "TOEFL", en: "TOEFL" },
  step: { ar: "STEP", en: "STEP" },
  act: { ar: "ACT", en: "ACT" },
  mawhiba: { ar: "موهبة", en: "Mawhiba" },
  mawhiba_annual: { ar: "موهبة السنوي", en: "Mawhiba Annual" },
  gifted_discovery: { ar: "الكشف عن الموهوبين", en: "Gifted Discovery" },
  gifted_screening: { ar: "الكشف عن الموهوبين", en: "Gifted Screening" },
  qiyas: { ar: "قياس", en: "Qiyas" },
  language_test: { ar: "اختبار لغة", en: "Language Test" },
  other: { ar: "اختبار معياري", en: "Standardized Test" },
};

export const resolveStandardizedScoreDisplay = (
  input: StandardizedTestInput,
  loc: "ar" | "en"
): StandardizedScoreDisplay | null => {
  const testType = resolveStandardizedTestType(input);
  if (!testType) return null;

  const labels = TEST_LABELS[testType] ?? TEST_LABELS.other;
  const meta = buildStandardizedTestMetadata(input);
  const rt = safeTrim(input.resultType).toLowerCase();

  if (!meta) {
    if (testType === "qudrat") {
      return {
        testType,
        displayAr: `${labels.ar} — مشاركة`,
        displayEn: `${labels.en} — Participation`,
        rawScore: null,
        scoreScale: "participation",
        scoreLabel: loc === "ar" ? "مشاركة" : "Participation",
        isValid: false,
      };
    }
    if (rt === "participation") {
      return {
        testType,
        displayAr: `${labels.ar} — مشاركة`,
        displayEn: `${labels.en} — Participation`,
        rawScore: null,
        scoreScale: "participation",
        scoreLabel: loc === "ar" ? "مشاركة" : "Participation",
        isValid: false,
      };
    }
    return null;
  }

  const scorePart = meta.scoreLabel;
  return {
    testType,
    displayAr: `${labels.ar} ${scorePart}`,
    displayEn: `${labels.en} ${scorePart}`,
    rawScore: meta.rawScore,
    scoreScale: meta.scoreScale,
    scoreLabel: meta.scoreLabel,
    isValid: true,
  };
};

/** Numeric value for analytics comparisons (percentile-equivalent where possible). */
export const resolveStandardizedComparableScore = (
  input: StandardizedTestInput
): number | null => {
  const meta = buildStandardizedTestMetadata(input);
  if (!meta) return null;
  if (meta.scoreScale === "percentage" || meta.scoreScale === "points" || meta.scoreScale === "band") {
    return meta.normalizedScore ?? meta.rawScore;
  }
  return meta.rawScore;
};

export const isStandardizedTestAchievement = (input: StandardizedTestInput): boolean =>
  resolveStandardizedTestType(input) != null;

export type StandardizedScoreFilter = {
  testType?: StandardizedTestType;
  min?: number;
  max?: number;
};

export const matchesStandardizedScoreFilter = (
  input: StandardizedTestInput,
  filter: StandardizedScoreFilter
): boolean => {
  const testType = resolveStandardizedTestType(input);
  if (!testType) return true;
  if (filter.testType && filter.testType !== testType) return false;
  const score = resolveStandardizedComparableScore(input);
  if (score == null) return filter.min == null && filter.max == null;
  if (filter.min != null && score < filter.min) return false;
  if (filter.max != null && score > filter.max) return false;
  return true;
};

export const getStandardizedTestInputConfig = (
  testType: StandardizedTestType
): {
  inputMode: "decimal" | "numeric";
  min: number;
  max: number;
  step: number;
  placeholderAr: string;
  placeholderEn: string;
  hintAr: string;
  hintEn: string;
} => {
  switch (testType) {
    case "ielts":
      return {
        inputMode: "decimal",
        min: 0,
        max: 9,
        step: 0.5,
        placeholderAr: "مثال: 7.5",
        placeholderEn: "e.g. 7.5",
        hintAr: "درجة Band من 0 إلى 9",
        hintEn: "Band score from 0 to 9",
      };
    case "sat":
      return {
        inputMode: "numeric",
        min: 400,
        max: 1600,
        step: 1,
        placeholderAr: "مثال: 1450",
        placeholderEn: "e.g. 1450",
        hintAr: "درجة SAT من 400 إلى 1600",
        hintEn: "SAT score from 400 to 1600",
      };
    case "toefl":
      return {
        inputMode: "numeric",
        min: 0,
        max: 120,
        step: 1,
        placeholderAr: "مثال: 108",
        placeholderEn: "e.g. 108",
        hintAr: "درجة TOEFL من 0 إلى 120",
        hintEn: "TOEFL score from 0 to 120",
      };
    case "act":
      return {
        inputMode: "numeric",
        min: 1,
        max: 36,
        step: 1,
        placeholderAr: "مثال: 32",
        placeholderEn: "e.g. 32",
        hintAr: "درجة ACT من 1 إلى 36",
        hintEn: "ACT score from 1 to 36",
      };
    case "qudrat":
    case "tahsili":
    case "step":
      return {
        inputMode: "numeric",
        min: 0,
        max: 100,
        step: 1,
        placeholderAr: "مثال: 99",
        placeholderEn: "e.g. 99",
        hintAr: "نسبة مئوية من 0 إلى 100",
        hintEn: "Percentage from 0 to 100",
      };
    case "gifted_discovery":
      return {
        inputMode: "numeric",
        min: 1601,
        max: 9999,
        step: 1,
        placeholderAr: "مثال: 1750",
        placeholderEn: "e.g. 1750",
        hintAr: "درجة أعلى من 1600",
        hintEn: "Score greater than 1600",
      };
    default:
      return {
        inputMode: "numeric",
        min: 0,
        max: 9999,
        step: 1,
        placeholderAr: "أدخل الدرجة",
        placeholderEn: "Enter score",
        hintAr: "",
        hintEn: "",
      };
  }
};
