/**
 * Historical ranking engine — places, finalists, national/international scope.
 */

import type { ParticipationActivityRow } from "@/lib/achievement-participation-analytics";

export type RankingIntelligence = {
  rankCount: number;
  firstPlace: number;
  top10: number;
  finalists: number;
  nationalRanking: number;
  internationalRanking: number;
  rankingScore: number;
};

const isFirstPlaceResult = (row: ParticipationActivityRow): boolean =>
  /first|1st|الأول|مركز أول|rank.?1/i.test(
    `${row.participationResultKey} ${row.participationResultAr} ${row.participationResultEn}`
  );

const isTop10Result = (row: ParticipationActivityRow): boolean =>
  /top.?10|عشرة الأوائل|top ten/i.test(
    `${row.participationResultKey} ${row.participationResultAr} ${row.participationResultEn}`
  ) || row.rankCount > 0;

const isFinalistResult = (row: ParticipationActivityRow): boolean =>
  /final|نهائي|finalist/i.test(
    `${row.participationResultKey} ${row.participationResultAr} ${row.participationResultEn}`
  );

export const extractRankingIntelligence = (rows: ParticipationActivityRow[]): RankingIntelligence => {
  let rankCount = 0;
  let firstPlace = 0;
  let top10 = 0;
  let finalists = 0;
  let nationalRanking = 0;
  let internationalRanking = 0;

  for (const r of rows) {
    rankCount += r.rankCount;
    if (isFirstPlaceResult(r)) firstPlace += Math.max(1, r.rankCount || 1);
    if (isTop10Result(r)) top10 += Math.max(1, r.rankCount || 1);
    if (isFinalistResult(r)) finalists += 1;

    const level = String(r.levelKey || "").toLowerCase();
    if (level === "kingdom" || level === "province" || level === "school") {
      nationalRanking += r.rankCount;
    }
    if (level === "international" || level === "global") {
      internationalRanking += r.rankCount;
    }
  }

  const rankingScore = Math.min(
    100,
    firstPlace * 10 + top10 * 3 + rankCount + internationalRanking * 2
  );

  return {
    rankCount,
    firstPlace,
    top10,
    finalists,
    nationalRanking,
    internationalRanking,
    rankingScore,
  };
};

export const rankingMetricValue = (
  rows: ParticipationActivityRow[],
  key: "rankings" | "first_place" | "ranking_score"
): number => {
  const r = extractRankingIntelligence(rows);
  if (key === "first_place") return r.firstPlace;
  if (key === "ranking_score") return r.rankingScore;
  return r.rankCount;
};
