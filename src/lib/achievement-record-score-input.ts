import type { CalculateScoreInput } from "@/lib/achievement-scoring";

/** Map a lean achievement / API row to scoring input (no side effects). */
export const achievementLikeToScoreInput = (a: Record<string, unknown>): CalculateScoreInput => ({
  achievementType: String(a.achievementType || ""),
  achievementLevel: String(a.achievementLevel || a.level || ""),
  resultType: String(a.resultType || ""),
  achievementName: String(a.achievementName || "") || undefined,
  medalType: String(a.medalType || "") || undefined,
  rank: String(a.rank || "") || undefined,
  participationType: String(a.participationType || "") || undefined,
  requiresCommitteeReview: a.requiresCommitteeReview === true,
});
