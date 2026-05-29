/**
 * achievement-density-engine.ts
 * Quantifies award/outcome density across activities and years.
 */
import type { RawActivityRecord } from "./student-activity-loader";

export type DensityBreakdown = {
  totalRecords: number;
  medalCount: number;
  goldCount: number;
  silverCount: number;
  bronzeCount: number;
  rankCount: number;
  nominationCount: number;
  participationOnlyCount: number;
  medalDensityPct: number;     // medals / total
  awardDensityPct: number;     // any positive outcome / total
  activityDiversity: number;   // unique canonical keys
  peakYearActivity: number;    // year with most activity
  peakYearCount: number;
  avgPerYear: number;
};

const isMedal   = (r: RawActivityRecord) => r.outcomeKey.startsWith("medal:");
const isRank    = (r: RawActivityRecord) => r.outcomeKey.startsWith("rank:");
const isNom     = (r: RawActivityRecord) => r.outcomeKey === "nomination";
const isPositive = (r: RawActivityRecord) =>
  isMedal(r) || isRank(r) || isNom(r) || r.outcomeKey === "special_award";

export const buildAchievementDensity = (
  records: RawActivityRecord[]
): DensityBreakdown => {
  const total = records.length;
  if (total === 0) {
    return {
      totalRecords: 0,
      medalCount: 0,
      goldCount: 0,
      silverCount: 0,
      bronzeCount: 0,
      rankCount: 0,
      nominationCount: 0,
      participationOnlyCount: 0,
      medalDensityPct: 0,
      awardDensityPct: 0,
      activityDiversity: 0,
      peakYearActivity: 0,
      peakYearCount: 0,
      avgPerYear: 0,
    };
  }

  let gold = 0, silver = 0, bronze = 0, rank = 0, nom = 0, part = 0;
  const yearCounts = new Map<number, number>();
  const activityKeys = new Set<string>();

  for (const r of records) {
    activityKeys.add(r.canonicalActivityKey);
    yearCounts.set(r.achievementYear, (yearCounts.get(r.achievementYear) ?? 0) + 1);
    if (r.medalType === "gold") gold++;
    else if (r.medalType === "silver") silver++;
    else if (r.medalType === "bronze") bronze++;
    if (isRank(r)) rank++;
    if (isNom(r)) nom++;
    if (r.outcomeKey === "participation") part++;
  }

  const medals = gold + silver + bronze;
  const awards = records.filter(isPositive).length;
  const activeYears = yearCounts.size;

  let peakYear = 0, peakCount = 0;
  for (const [yr, cnt] of yearCounts) {
    if (cnt > peakCount) { peakCount = cnt; peakYear = yr; }
  }

  return {
    totalRecords: total,
    medalCount: medals,
    goldCount: gold,
    silverCount: silver,
    bronzeCount: bronze,
    rankCount: rank,
    nominationCount: nom,
    participationOnlyCount: part,
    medalDensityPct: Math.round((medals / total) * 1000) / 10,
    awardDensityPct: Math.round((awards / total) * 1000) / 10,
    activityDiversity: activityKeys.size,
    peakYearActivity: peakYear,
    peakYearCount: peakCount,
    avgPerYear: activeYears > 0 ? Math.round((total / activeYears) * 10) / 10 : total,
  };
};
