/**
 * Weighted student ranking for analytics panels (distinct by participantId).
 */

export type RankingAchievementInput = {
  participantId: string;
  resultType?: string;
  medalType?: string;
  rank?: string;
  achievementLevel?: string;
  achievementId?: string;
};

export type RankedStudentScore = {
  participantId: string;
  recordCount: number;
  medalCount: number;
  weightedScore: number;
  achievementIds: string[];
};

const LEVEL_MULTIPLIER: Record<string, number> = {
  international: 1.5,
  kingdom: 1.25,
  province: 1.1,
  school: 1,
};

const resultPoints = (row: RankingAchievementInput): number => {
  const rt = String(row.resultType || "").trim();
  const lvl = LEVEL_MULTIPLIER[String(row.achievementLevel || "school").trim()] ?? 1;
  let base = 1;
  if (rt === "medal") {
    const mt = String(row.medalType || "").trim();
    if (mt === "gold") base = 10;
    else if (mt === "silver") base = 7;
    else if (mt === "bronze") base = 5;
    else base = 4;
  } else if (rt === "nomination") base = 3;
  else if (rt === "rank") {
    const rk = String(row.rank || "").trim();
    if (rk === "first") base = 9;
    else if (rk === "second") base = 7;
    else if (rk === "third") base = 5;
    else base = 4;
  } else if (rt === "participation") base = 1;
  else if (rt === "completion" || rt === "score") base = 2;
  return Math.round(base * lvl * 10) / 10;
};

/** Aggregate rows per participant; dedupe achievement ids when provided. */
export const buildWeightedStudentRankings = (
  rows: RankingAchievementInput[],
  opts?: { minRecords?: number; limit?: number }
): RankedStudentScore[] => {
  const minRecords = opts?.minRecords ?? 1;
  const limit = opts?.limit ?? 20;
  const map = new Map<string, RankedStudentScore>();

  for (const row of rows) {
    const pid = String(row.participantId || "").trim();
    if (!pid) continue;
    const aid = String(row.achievementId || "").trim();
    let hit = map.get(pid);
    if (!hit) {
      hit = { participantId: pid, recordCount: 0, medalCount: 0, weightedScore: 0, achievementIds: [] };
      map.set(pid, hit);
    }
    if (aid && hit.achievementIds.includes(aid)) continue;
    if (aid) hit.achievementIds.push(aid);
    hit.recordCount += 1;
    if (String(row.resultType || "") === "medal") hit.medalCount += 1;
    hit.weightedScore += resultPoints(row);
  }

  return [...map.values()]
    .filter((r) => r.recordCount >= minRecords)
    .sort(
      (a, b) =>
        b.weightedScore - a.weightedScore ||
        b.medalCount - a.medalCount ||
        b.recordCount - a.recordCount
    )
    .slice(0, limit);
};

/** Re-rank existing intel rows using weighted score while preserving display fields. */
export const sortIntelRowsByWeightedScore = <T extends { participantId: string; recordCount: number; medalCount: number }>(
  rows: T[],
  scoreById: Map<string, number>
): T[] => {
  const seen = new Set<string>();
  const unique = rows.filter((r) => {
    if (seen.has(r.participantId)) return false;
    seen.add(r.participantId);
    return true;
  });
  return [...unique].sort(
    (a, b) =>
      (scoreById.get(b.participantId) ?? 0) - (scoreById.get(a.participantId) ?? 0) ||
      b.medalCount - a.medalCount ||
      b.recordCount - a.recordCount
  );
};
