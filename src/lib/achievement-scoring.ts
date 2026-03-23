/**
 * Achievement Auto-Scoring — single source of truth.
 * Points scale by (1) normalized level and (2) result kind (participation vs competitive outcomes).
 */

import type { AchievementScoreResult } from "@/types/achievement";

/** Internal tier order: school < province < national < international */
export type ScoringLevelKey = "school" | "province" | "national" | "international";

const LEVEL_ORDER: ScoringLevelKey[] = ["school", "province", "national", "international"];

const isScoringLevelKey = (v: string): v is ScoringLevelKey =>
  (LEVEL_ORDER as string[]).includes(v);

/**
 * Maps DB/UI labels (EN/AR/legacy) to the four scoring tiers. Does not mutate stored values.
 */
export const normalizeAchievementLevelForScoring = (raw: string): ScoringLevelKey | null => {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  if (!s) return null;

  const aliases: Record<string, ScoringLevelKey> = {
    school: "school",
    class: "school",
    classroom: "school",
    مدرسة: "school",

    province: "province",
    governorate: "province",
    district: "province",
    regional: "province",
    region: "province",
    state: "province",
    admin: "province",
    administration: "province",
    "local_authority": "province",
    locality: "province",
    محافظة: "province",
    ادارة: "province",
    إدارة: "province",

    kingdom: "national",
    national: "national",
    country: "national",
    ksa: "national",
    "saudi_arabia": "national",
    وطني: "national",
    المملكة: "national",
    مملكة: "national",

    international: "international",
    global: "international",
    world: "international",
    worldwide: "international",
    intl: "international",
    عالمي: "international",
    دولي: "international",
    دولية: "international",
  };

  if (isScoringLevelKey(s)) return s;
  if (aliases[s]) return aliases[s];

  // Fuzzy contains (legacy free text)
  if (/(international|global|world|عالمي|دولي)/i.test(raw)) return "international";
  if (/(kingdom|national|وطني|المملكة|ksa)/i.test(raw)) return "national";
  if (/(province|governorate|district|regional|محافظة|إدارة|ادارة)/i.test(raw)) return "province";
  if (/(school|مدرسة|class)/i.test(raw)) return "school";

  return null;
};

const normalizeResultTypeToken = (raw: string): string =>
  String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

/** Maps legacy/synonym result labels to canonical scoring keys */
export const normalizeResultTypeForScoring = (raw: string): string => {
  const t = normalizeResultTypeToken(raw);
  const map: Record<string, string> = {
    participation: "participation",
    مشاركة: "participation",
    medal: "medal",
    ميدالية: "medal",
    rank: "rank",
    مركز: "rank",
    placing: "rank",
    position: "rank",
    nomination: "nomination",
    ترشيح: "nomination",
    qualification: "nomination",
    تأهل: "nomination",
    special_award: "special_award",
    specialaward: "special_award",
    award: "special_award",
    جائزة: "special_award",
    recognition: "recognition",
    تكريم: "recognition",
    other: "other",
    أخرى: "other",
    score: "score",
    completion: "completion",
    درجة: "score",
  };
  return map[t] || t;
};

/**
 * If stored as "participation" but structured fields indicate a competitive outcome, use the stronger kind.
 * (Structured fields only — avoids mis-scoring when free text mentions medals without a subtype.)
 */
const resolveEffectiveResultType = (input: CalculateScoreInput): string => {
  const t = normalizeResultTypeForScoring(input.resultType);

  const hasMedal = Boolean(String(input.medalType || "").trim());
  const hasRank = Boolean(String(input.rank || "").trim());

  if (t === "participation" && hasMedal) return "medal";
  if (t === "participation" && hasRank) return "rank";

  return t;
};

/** Participation-only: must differ by level (strictly increasing) */
const PARTICIPATION: Record<ScoringLevelKey, number> = {
  school: 4,
  province: 8,
  national: 16,
  international: 32,
};

const RECOGNITION: Record<ScoringLevelKey, number> = {
  school: 6,
  province: 12,
  national: 24,
  international: 48,
};

const OTHER: Record<ScoringLevelKey, number> = {
  school: 5,
  province: 10,
  national: 20,
  international: 40,
};

const NOMINATION: Record<ScoringLevelKey, number> = {
  school: 12,
  province: 24,
  national: 48,
  international: 96,
};

const SPECIAL_AWARD: Record<ScoringLevelKey, number> = {
  school: 24,
  province: 48,
  national: 96,
  international: 192,
};

const MEDAL: {
  gold: Record<ScoringLevelKey, number>;
  silver: Record<ScoringLevelKey, number>;
  bronze: Record<ScoringLevelKey, number>;
} = {
  /** School-tier medals stay below international plain participation (32) */
  gold: { school: 28, province: 64, national: 128, international: 256 },
  silver: { school: 24, province: 48, national: 96, international: 192 },
  bronze: { school: 18, province: 36, national: 72, international: 144 },
};

const RANK: Record<string, Record<ScoringLevelKey, number>> = {
  first: { school: 40, province: 80, national: 160, international: 320 },
  second: { school: 32, province: 64, national: 128, international: 256 },
  third: { school: 24, province: 48, national: 96, international: 192 },
  fourth: { school: 20, province: 40, national: 80, international: 160 },
  fifth: { school: 16, province: 32, national: 64, international: 128 },
  sixth: { school: 14, province: 28, national: 56, international: 112 },
  seventh: { school: 12, province: 24, national: 48, international: 96 },
  eighth: { school: 10, province: 20, national: 40, international: 80 },
  ninth: { school: 8, province: 16, national: 32, international: 64 },
  tenth: { school: 6, province: 12, national: 24, international: 48 },
};

/** Qudrat tier keys (form / DB achievementName) → medal tier at national (kingdom) level */
export const qudratAchievementNameToMedalType = (
  raw: string
): "gold" | "silver" | "bronze" | null => {
  const n = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (n === "qudrat_100") return "gold";
  if (n === "qudrat_99") return "silver";
  if (n === "qudrat_98") return "bronze";
  return null;
};

export interface CalculateScoreInput {
  achievementType: string;
  achievementLevel: string;
  resultType: string;
  /** Used for Qudrat: qudrat_100 / qudrat_99 / qudrat_98 → kingdom medal-equivalent points */
  achievementName?: string;
  medalType?: string;
  rank?: string;
  participationType?: string;
  requiresCommitteeReview?: boolean;
}

export function calculateAchievementScore(input: CalculateScoreInput): AchievementScoreResult {
  const validationErrors: string[] = [];
  let baseScore = 0;
  let levelMultiplier = 1;
  let resultMultiplier = 1;
  const typeBonus = 0;

  if (input.requiresCommitteeReview) {
    return {
      score: 0,
      scoreBreakdown: {
        baseScore: 0,
        levelMultiplier: 1,
        resultMultiplier: 1,
        typeBonus: 0,
        total: 0,
        normalizedLevel: undefined,
        effectiveResultType: undefined,
      },
      isEligible: true,
      validationErrors: [],
    };
  }

  if (!input.achievementType) validationErrors.push("Achievement type is required");
  if (!input.achievementLevel) validationErrors.push("Achievement level is required");
  if (!input.resultType) validationErrors.push("Result type is required");

  if (validationErrors.length > 0) {
    return {
      score: 0,
      scoreBreakdown: {
        baseScore: 0,
        levelMultiplier: 1,
        resultMultiplier: 1,
        total: 0,
        normalizedLevel: undefined,
        effectiveResultType: undefined,
      },
      isEligible: false,
      validationErrors,
    };
  }

  const normalizedLevel = normalizeAchievementLevelForScoring(input.achievementLevel);
  if (!normalizedLevel) {
    validationErrors.push("Unknown or unsupported achievement level");
    return {
      score: 0,
      scoreBreakdown: {
        baseScore: 0,
        levelMultiplier: 1,
        resultMultiplier: 1,
        total: 0,
        normalizedLevel: undefined,
        effectiveResultType: undefined,
      },
      isEligible: false,
      validationErrors,
    };
  }

  const qudratTierMedal =
    input.achievementType === "qudrat"
      ? qudratAchievementNameToMedalType(String(input.achievementName || ""))
      : null;

  if (input.achievementType === "qudrat" && !qudratTierMedal) {
    validationErrors.push(
      "Qudrat tier is required for scoring (100%, 99%, or 98%)"
    );
    return {
      score: 0,
      scoreBreakdown: {
        baseScore: 0,
        levelMultiplier: 1,
        resultMultiplier: 1,
        typeBonus: 0,
        total: 0,
        normalizedLevel,
        effectiveResultType: undefined,
      },
      isEligible: false,
      validationErrors,
    };
  }

  let effectiveResultType = resolveEffectiveResultType(input);
  if (qudratTierMedal) {
    effectiveResultType = "medal";
  }

  if (input.participationType === "team") {
    resultMultiplier = 0.8;
  }

  switch (effectiveResultType) {
    case "participation":
      baseScore = PARTICIPATION[normalizedLevel];
      break;

    case "medal": {
      const mt = String(qudratTierMedal || input.medalType || "")
        .trim()
        .toLowerCase();
      if (!mt) {
        validationErrors.push("Medal type is required for medal result");
        break;
      }
      const medalRow = MEDAL[mt as keyof typeof MEDAL];
      const levelForMedal: ScoringLevelKey = qudratTierMedal ? "national" : normalizedLevel;
      if (medalRow) baseScore = medalRow[levelForMedal];
      else validationErrors.push("Invalid medal type");
      break;
    }

    case "rank": {
      const rk = String(input.rank || "").trim().toLowerCase();
      if (!rk) {
        validationErrors.push("Rank is required for rank result");
        break;
      }
      const rankRow = RANK[rk];
      if (rankRow) baseScore = rankRow[normalizedLevel];
      else validationErrors.push("Invalid rank value");
      break;
    }

    case "nomination":
      baseScore = NOMINATION[normalizedLevel];
      break;

    case "special_award":
      baseScore = SPECIAL_AWARD[normalizedLevel];
      break;

    case "recognition":
      baseScore = RECOGNITION[normalizedLevel];
      break;

    case "other":
      baseScore = OTHER[normalizedLevel];
      break;

    case "score":
    case "completion":
      baseScore = PARTICIPATION[normalizedLevel];
      break;

    default:
      validationErrors.push(`Unknown result type: ${input.resultType}`);
  }

  const score = Math.round(baseScore * levelMultiplier * resultMultiplier + typeBonus);

  const isEligible = validationErrors.length === 0 && score > 0;

  return {
    score,
    scoreBreakdown: {
      baseScore,
      levelMultiplier,
      resultMultiplier,
      typeBonus,
      total: score,
      normalizedLevel,
      effectiveResultType,
    },
    isEligible,
    validationErrors,
  };
}
