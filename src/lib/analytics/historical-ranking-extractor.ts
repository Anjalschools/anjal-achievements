/**
 * Ranking extraction from achievement rows + KPI fallbacks.
 */

import type { ParticipationActivityRow } from "@/lib/achievement-participation-analytics";
import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";

export type ExtractedRankings = {
  rankings: number;
  firstPlace: number;
  top3: number;
  top10: number;
  nationalRanking: number;
  internationalRanking: number;
  rankingScore: number;
  fromKpiFallback: boolean;
};

const resultText = (row: ParticipationActivityRow): string =>
  `${row.participationResultKey ?? ""} ${row.participationResultAr ?? ""} ${row.participationResultEn ?? ""}`.toLowerCase();

export const extractRankingsFromRows = (
  rows: ParticipationActivityRow[],
  kpi?: ParticipationAnalyticsPayload["kpis"]
): ExtractedRankings => {
  let rankings = 0;
  let firstPlace = 0;
  let top3 = 0;
  let top10 = 0;
  let nationalRanking = 0;
  let internationalRanking = 0;

  for (const row of rows) {
    const rc = Number(row.rankCount ?? 0);
    rankings += rc;
    const t = resultText(row);
    if (/first|1st|الأول|مركز أول|rank.?1/i.test(t)) {
      firstPlace += Math.max(1, rc);
    }
    if (/top.?3|ثلاثة|top three/i.test(t)) top3 += Math.max(1, rc);
    if (/top.?10|عشرة|top ten/i.test(t) || rc > 0) top10 += Math.max(1, rc);

    const level = String(row.levelKey ?? "").toLowerCase();
    if (level === "international" || level === "global") internationalRanking += rc;
    else nationalRanking += rc;
  }

  let fromKpiFallback = false;
  const kpiFirst = Number(kpi?.firstPlaceCount ?? 0);
  if (firstPlace === 0 && kpiFirst > 0 && rows.length > 0) {
    firstPlace = kpiFirst;
    rankings = Math.max(rankings, kpiFirst);
    fromKpiFallback = true;
  }

  const rankingScore = Math.min(
    100,
    firstPlace * 10 + top3 * 5 + top10 * 2 + rankings + internationalRanking * 2
  );

  return {
    rankings,
    firstPlace,
    top3,
    top10,
    nationalRanking,
    internationalRanking,
    rankingScore,
    fromKpiFallback,
  };
};
