/**
 * Achievement Auto-Scoring — single source of truth.
 * Points: round(basePoints × levelMultiplier × teamFactor + bonus)
 * Uses platform ScoringConfig when provided; otherwise DEFAULT_SCORING_CONFIG (backward-compatible).
 */

import type { AchievementScoreBreakdown, AchievementScoreResult } from "@/types/achievement";
import { DEFAULT_SCORING_CONFIG, type ScoringConfig } from "@/constants/default-scoring";

/** Internal tier order: school < province < national < international */
export type ScoringLevelKey = "school" | "province" | "national" | "international";

const LEVEL_ORDER: ScoringLevelKey[] = ["school", "province", "national", "international"];

const isScoringLevelKey = (v: string): v is ScoringLevelKey =>
  (LEVEL_ORDER as string[]).includes(v);

const emptyBreakdown = (partial?: Partial<AchievementScoreBreakdown>): AchievementScoreBreakdown => ({
  baseScore: 0,
  levelMultiplier: 1,
  resultMultiplier: 1,
  teamFactor: 1,
  typeBonus: 0,
  bonusPoints: 0,
  preRoundedTotal: 0,
  total: 0,
  roundingMode: "round",
  ...partial,
});

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

const resolveEffectiveResultType = (input: CalculateScoreInput): string => {
  const t = normalizeResultTypeForScoring(input.resultType);

  const hasMedal = Boolean(String(input.medalType || "").trim());
  const hasRank = Boolean(String(input.rank || "").trim());

  if (t === "participation" && hasMedal) return "medal";
  if (t === "participation" && hasRank) return "rank";

  return t;
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
  if (n === "qudrat_97" || n === "qudrat_96" || n === "qudrat_95") return "bronze";
  return null;
};

export interface CalculateScoreInput {
  achievementType: string;
  achievementLevel: string;
  resultType: string;
  achievementName?: string;
  medalType?: string;
  rank?: string;
  participationType?: string;
  requiresCommitteeReview?: boolean;
  /** When omitted, DEFAULT_SCORING_CONFIG is used (same numeric results as legacy hardcoded tables). */
  scoringConfig?: ScoringConfig;
}

type BaseRuleResult = { baseScore: number; matchedRuleKey?: string };

const resolveBaseScore = (
  cfg: ScoringConfig,
  effectiveResultType: string,
  normalizedLevel: ScoringLevelKey,
  input: CalculateScoreInput,
  qudratTierMedal: "gold" | "silver" | "bronze" | null,
  validationErrors: string[]
): BaseRuleResult => {
  switch (effectiveResultType) {
    case "participation":
      return {
        baseScore: cfg.participation[normalizedLevel],
        matchedRuleKey: `participation:${normalizedLevel}`,
      };

    case "medal": {
      const mt = String(qudratTierMedal || input.medalType || "")
        .trim()
        .toLowerCase();
      if (!mt) {
        validationErrors.push("Medal type is required for medal result");
        return { baseScore: 0 };
      }
      const medalRow = cfg.medal[mt as keyof typeof cfg.medal];
      const levelForMedal: ScoringLevelKey = qudratTierMedal ? "national" : normalizedLevel;
      if (!medalRow) {
        validationErrors.push("Invalid medal type");
        return { baseScore: 0 };
      }
      return {
        baseScore: medalRow[levelForMedal],
        matchedRuleKey: `medal:${mt}:${levelForMedal}`,
      };
    }

    case "rank": {
      const rk = String(input.rank || "").trim().toLowerCase();
      if (!rk) {
        validationErrors.push("Rank is required for rank result");
        return { baseScore: 0 };
      }
      const rankRow = cfg.rank[rk as keyof typeof cfg.rank];
      if (!rankRow) {
        validationErrors.push("Invalid rank value");
        return { baseScore: 0 };
      }
      return {
        baseScore: rankRow[normalizedLevel],
        matchedRuleKey: `rank:${rk}:${normalizedLevel}`,
      };
    }

    case "nomination":
      return {
        baseScore: cfg.nomination[normalizedLevel],
        matchedRuleKey: `nomination:${normalizedLevel}`,
      };

    case "special_award":
      return {
        baseScore: cfg.specialAward[normalizedLevel],
        matchedRuleKey: `special_award:${normalizedLevel}`,
      };

    case "recognition":
      return {
        baseScore: cfg.recognition[normalizedLevel],
        matchedRuleKey: `recognition:${normalizedLevel}`,
      };

    case "other":
      return {
        baseScore: cfg.other[normalizedLevel],
        matchedRuleKey: `other:${normalizedLevel}`,
      };

    case "score":
    case "completion":
      return {
        baseScore: cfg.participation[normalizedLevel],
        matchedRuleKey: `participation_as_score:${normalizedLevel}`,
      };

    default:
      validationErrors.push(`Unknown result type: ${input.resultType}`);
      return { baseScore: 0 };
  }
};

export function calculateAchievementScore(input: CalculateScoreInput): AchievementScoreResult {
  const validationErrors: string[] = [];
  const cfg = input.scoringConfig ?? DEFAULT_SCORING_CONFIG;

  if (input.requiresCommitteeReview) {
    return {
      score: 0,
      scoreBreakdown: emptyBreakdown({
        normalizedLevel: undefined,
        effectiveResultType: undefined,
      }),
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
      scoreBreakdown: emptyBreakdown(),
      isEligible: false,
      validationErrors,
    };
  }

  const normalizedLevel = normalizeAchievementLevelForScoring(input.achievementLevel);
  if (!normalizedLevel) {
    validationErrors.push("Unknown or unsupported achievement level");
    return {
      score: 0,
      scoreBreakdown: emptyBreakdown(),
      isEligible: false,
      validationErrors,
    };
  }

  const qudratTierMedal =
    input.achievementType === "qudrat"
      ? qudratAchievementNameToMedalType(String(input.achievementName || ""))
      : null;

  if (input.achievementType === "qudrat" && !qudratTierMedal) {
    validationErrors.push("Qudrat tier is required for scoring (95% through 100%)");
    return {
      score: 0,
      scoreBreakdown: emptyBreakdown({
        normalizedLevel,
        effectiveResultType: undefined,
      }),
      isEligible: false,
      validationErrors,
    };
  }

  let effectiveResultType = resolveEffectiveResultType(input);
  if (qudratTierMedal) {
    effectiveResultType = "medal";
  }

  const levelMultiplier = cfg.levelMultipliers[normalizedLevel] ?? 1;
  const teamFactor = input.participationType === "team" ? cfg.teamResultMultiplier : 1;
  const typeBonus = Number(cfg.typeBonus) || 0;

  const { baseScore, matchedRuleKey } = resolveBaseScore(
    cfg,
    effectiveResultType,
    normalizedLevel,
    input,
    qudratTierMedal,
    validationErrors
  );

  const preRoundedTotal = baseScore * levelMultiplier * teamFactor + typeBonus;
  const score = Math.round(preRoundedTotal);

  const scoreBreakdown: AchievementScoreBreakdown = {
    baseScore,
    levelMultiplier,
    resultMultiplier: teamFactor,
    teamFactor,
    typeBonus,
    bonusPoints: typeBonus,
    preRoundedTotal,
    total: score,
    roundingMode: "round",
    matchedRuleKey,
    normalizedLevel,
    effectiveResultType,
  };

  const isEligible = validationErrors.length === 0 && score > 0;

  return {
    score,
    scoreBreakdown,
    isEligible,
    validationErrors,
  };
}
