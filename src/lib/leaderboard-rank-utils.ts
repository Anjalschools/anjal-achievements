/**
 * Pure rank ordering helpers — mirror Mongo `buildSortSpec` default for student rank:
 * totalPoints desc → achievementsCount desc → latestAchievementDate desc → userId asc.
 */

export type RankableLeaderboardRow = {
  userId: string;
  totalPoints: number;
  achievementsCount: number;
  latestAchievementDate: Date | string | null;
};

const toTime = (value: Date | string | null): number => {
  if (!value) return 0;
  const t = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(t) ? t : 0;
};

/** Returns negative if `a` ranks ahead of `b` (appears earlier in the leaderboard). */
export const compareLeaderboardRankRows = (
  a: RankableLeaderboardRow,
  b: RankableLeaderboardRow
): number => {
  if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
  if (b.achievementsCount !== a.achievementsCount) return b.achievementsCount - a.achievementsCount;
  const dateDiff = toTime(b.latestAchievementDate) - toTime(a.latestAchievementDate);
  if (dateDiff !== 0) return dateDiff;
  return a.userId.localeCompare(b.userId);
};

export const sortLeaderboardRankRows = <T extends RankableLeaderboardRow>(rows: T[]): T[] =>
  [...rows].sort(compareLeaderboardRankRows);

export type StudentRankSummaryResult = {
  totalPoints: number;
  achievementsCount: number;
  rank: number | null;
  totalRankedStudents: number;
};

/** Legacy in-memory rank resolution (full materialized list). */
export const computeStudentRankSummaryFromRows = (
  rows: RankableLeaderboardRow[],
  userId: string
): StudentRankSummaryResult => {
  const sorted = sortLeaderboardRankRows(rows);
  const idx = sorted.findIndex((row) => row.userId === userId);
  if (idx < 0) {
    return {
      totalPoints: 0,
      achievementsCount: 0,
      rank: null,
      totalRankedStudents: sorted.length,
    };
  }
  const row = sorted[idx];
  return {
    totalPoints: row.totalPoints,
    achievementsCount: row.achievementsCount,
    rank: idx + 1,
    totalRankedStudents: sorted.length,
  };
};

/** Rank via ahead-count (equivalent to sorted position when ties use full sort keys). */
export const computeStudentRankSummaryByAheadCount = (
  rows: RankableLeaderboardRow[],
  userId: string
): StudentRankSummaryResult => {
  const target = rows.find((row) => row.userId === userId);
  if (!target) {
    return {
      totalPoints: 0,
      achievementsCount: 0,
      rank: null,
      totalRankedStudents: rows.length,
    };
  }
  const ahead = rows.filter((row) => compareLeaderboardRankRows(row, target) < 0).length;
  return {
    totalPoints: target.totalPoints,
    achievementsCount: target.achievementsCount,
    rank: ahead + 1,
    totalRankedStudents: rows.length,
  };
};
