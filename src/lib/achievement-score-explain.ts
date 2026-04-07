import type { AchievementScoreBreakdown } from "@/types/achievement";
import type { ScoringConfig } from "@/constants/default-scoring";
import { calculateAchievementScore, type CalculateScoreInput } from "@/lib/achievement-scoring";
import { achievementLikeToScoreInput } from "@/lib/achievement-record-score-input";

const fmtNum = (n: number): string => {
  if (!Number.isFinite(n)) return "—";
  if (Number.isInteger(n)) return String(n);
  const t = n.toFixed(2).replace(/\.?0+$/, "");
  return t;
};

/** Coerce legacy DB breakdown or partial objects into a full shape for display. */
export const coerceScoreBreakdownForDisplay = (raw: unknown): AchievementScoreBreakdown | null => {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const baseScore = Number(o.baseScore);
  if (!Number.isFinite(baseScore)) return null;
  const levelMultiplier = Number(o.levelMultiplier ?? 1);
  const teamFactor = Number(o.teamFactor ?? o.resultMultiplier ?? 1);
  const typeBonus = Number(o.typeBonus ?? o.bonusPoints ?? 0);
  let preRounded = Number(o.preRoundedTotal);
  if (!Number.isFinite(preRounded)) {
    preRounded = baseScore * levelMultiplier * teamFactor + typeBonus;
  }
  const totalRaw = Number(o.total);
  const total = Number.isFinite(totalRaw) ? totalRaw : Math.round(preRounded);
  return {
    baseScore,
    levelMultiplier: Number.isFinite(levelMultiplier) ? levelMultiplier : 1,
    resultMultiplier: teamFactor,
    teamFactor,
    typeBonus: Number.isFinite(typeBonus) ? typeBonus : 0,
    bonusPoints: Number.isFinite(typeBonus) ? typeBonus : 0,
    preRoundedTotal: preRounded,
    total,
    roundingMode: "round",
    matchedRuleKey: typeof o.matchedRuleKey === "string" ? o.matchedRuleKey : undefined,
    normalizedLevel: o.normalizedLevel as AchievementScoreBreakdown["normalizedLevel"],
    effectiveResultType: typeof o.effectiveResultType === "string" ? o.effectiveResultType : undefined,
  };
};

export type ScoreExplainLocale = "ar" | "en";

export type AchievementScoreExplanation = {
  equationLtr: string;
  lines: { label: string; value: string }[];
  /** Shown when rounded total differs from pre-rounded value */
  roundingNote?: string;
  /** When stored score on record differs from recomputed total */
  storedMismatchNote?: string;
};

export const buildAchievementScoreExplanation = (
  bd: AchievementScoreBreakdown,
  loc: ScoreExplainLocale
): AchievementScoreExplanation => {
  const { baseScore, levelMultiplier, teamFactor, bonusPoints, preRoundedTotal, total } = bd;
  const eq = `${fmtNum(baseScore)} × ${fmtNum(levelMultiplier)} × ${fmtNum(teamFactor)} + ${fmtNum(bonusPoints)} = ${fmtNum(preRoundedTotal)}`;
  const roundingNote =
    Math.abs(preRoundedTotal - total) > 1e-9
      ? loc === "ar"
        ? `${fmtNum(preRoundedTotal)} ← ${fmtNum(total)} (تقريب للنقاط المعتمدة)`
        : `${fmtNum(preRoundedTotal)} → ${fmtNum(total)} (rounded)`
      : undefined;

  const lines =
    loc === "ar"
      ? [
          { label: "النقاط الأساسية", value: fmtNum(baseScore) },
          { label: "مضاعف المستوى", value: fmtNum(levelMultiplier) },
          { label: "معامل الفريق", value: fmtNum(teamFactor) },
          { label: "المكافأة", value: fmtNum(bonusPoints) },
          { label: "الناتج النهائي", value: fmtNum(total) },
        ]
      : [
          { label: "Base points", value: fmtNum(baseScore) },
          { label: "Level multiplier", value: fmtNum(levelMultiplier) },
          { label: "Team factor", value: fmtNum(teamFactor) },
          { label: "Bonus", value: fmtNum(bonusPoints) },
          { label: "Final score", value: fmtNum(total) },
        ];

  return {
    equationLtr: eq,
    lines,
    roundingNote,
  };
};

/**
 * Uses a fresh calculation when eligible (current rules); otherwise falls back to stored breakdown.
 */
export const resolveAchievementScoreExplanation = (
  record: Record<string, unknown>,
  loc: ScoreExplainLocale,
  scoringConfig?: ScoringConfig
): AchievementScoreExplanation | null => {
  const stored = coerceScoreBreakdownForDisplay(record.scoreBreakdown);
  const input: CalculateScoreInput = {
    ...achievementLikeToScoreInput(record),
    scoringConfig,
  };
  const computed = calculateAchievementScore(input);

  let bd: AchievementScoreBreakdown | null = null;
  if (computed.isEligible && computed.score > 0) {
    bd = computed.scoreBreakdown;
  } else if (stored && stored.total > 0) {
    bd = stored;
  } else {
    return null;
  }

  const expl = buildAchievementScoreExplanation(bd, loc);
  const storedScore = typeof record.score === "number" ? record.score : Number(record.score);
  if (Number.isFinite(storedScore) && Math.round(storedScore) !== Math.round(bd.total)) {
    expl.storedMismatchNote =
      loc === "ar"
        ? `النقاط المحفوظة في السجل: ${Math.round(storedScore)} (قد يختلف إذا تغيّرت إعدادات النقاط لاحقًا).`
        : `Recorded score: ${Math.round(storedScore)} (may differ if scoring settings changed).`;
  }
  return expl;
};
