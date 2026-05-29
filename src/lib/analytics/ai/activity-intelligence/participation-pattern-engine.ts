/**
 * participation-pattern-engine.ts
 * Detects recurrence, specialization, transitions, gaps, and surges.
 */
import type { RawActivityRecord } from "./student-activity-loader";
import type { ActivityTimeline } from "./activity-timeline-builder";

export type ParticipationPattern = {
  /** Activities repeated in ≥ 2 years */
  recurringActivities: string[];
  /** Activity entered for the first time in the latest year */
  newActivities: string[];
  /** Activities where student achieved progressively better outcomes */
  progressingActivities: string[];
  /** Activities with declining outcomes */
  decliningActivities: string[];
  /** Gap years with zero activity */
  gapYears: number[];
  /** Year-over-year participation surge (+50% or more) */
  surgeYears: number[];
  dominantDomain: string;   // most-repeated canonical key
  specializationRatio: number; // % of records in dominant domain
};

const OUTCOME_RANK: Record<string, number> = {
  "medal:gold": 10, "medal:silver": 8, "medal:bronze": 6,
  "rank:first": 9, "rank:second": 8, "rank:third": 7,
  nomination: 5, special_award: 7, participation: 1,
};
const outcomeRank = (key: string) =>
  OUTCOME_RANK[key] ?? OUTCOME_RANK[key.split(":")[0]!] ?? 1;

export const detectParticipationPatterns = (
  timeline: ActivityTimeline,
  records: RawActivityRecord[]
): ParticipationPattern => {
  const { activeYears } = timeline;
  const byActivity = new Map<string, RawActivityRecord[]>();
  const byYear    = new Map<number, RawActivityRecord[]>();

  for (const r of records) {
    if (!byActivity.has(r.canonicalActivityKey))
      byActivity.set(r.canonicalActivityKey, []);
    byActivity.get(r.canonicalActivityKey)!.push(r);
    if (!byYear.has(r.achievementYear))
      byYear.set(r.achievementYear, []);
    byYear.get(r.achievementYear)!.push(r);
  }

  // recurring: present in ≥ 2 different years
  const recurring = [...byActivity.entries()]
    .filter(([, recs]) => new Set(recs.map((r) => r.achievementYear)).size >= 2)
    .map(([k]) => k);

  // new activities in latest year
  const latestYear = activeYears[activeYears.length - 1] ?? 0;
  const priorKeys = new Set(
    records.filter((r) => r.achievementYear < latestYear).map((r) => r.canonicalActivityKey)
  );
  const newActivities = [...byActivity.keys()].filter(
    (k) => !priorKeys.has(k) && byYear.get(latestYear)?.some((r) => r.canonicalActivityKey === k)
  );

  // progressing vs declining (first vs last appearance quality)
  const progressing: string[] = [];
  const declining: string[] = [];
  for (const [key, recs] of byActivity) {
    const sorted = [...recs].sort((a, b) => a.achievementYear - b.achievementYear);
    const first = outcomeRank(sorted[0]!.outcomeKey);
    const last  = outcomeRank(sorted[sorted.length - 1]!.outcomeKey);
    if (last > first) progressing.push(key);
    else if (last < first) declining.push(key);
  }

  // gap years
  const gapYears: number[] = [];
  if (activeYears.length >= 2) {
    const minY = activeYears[0]!;
    const maxY = activeYears[activeYears.length - 1]!;
    for (let y = minY + 1; y < maxY; y++) {
      if (!byYear.has(y)) gapYears.push(y);
    }
  }

  // surge years
  const surgeYears: number[] = [];
  for (let i = 1; i < activeYears.length; i++) {
    const prev = byYear.get(activeYears[i - 1]!)?.length ?? 0;
    const curr = byYear.get(activeYears[i]!)?.length ?? 0;
    if (prev > 0 && curr / prev >= 1.5) surgeYears.push(activeYears[i]!);
  }

  // dominant domain
  let dominantKey = "";
  let dominantCount = 0;
  for (const [k, recs] of byActivity) {
    if (recs.length > dominantCount) { dominantCount = recs.length; dominantKey = k; }
  }
  const specializationRatio =
    records.length > 0
      ? Math.round((dominantCount / records.length) * 100)
      : 0;

  return {
    recurringActivities: recurring,
    newActivities,
    progressingActivities: progressing,
    decliningActivities: declining,
    gapYears,
    surgeYears,
    dominantDomain: dominantKey,
    specializationRatio,
  };
};
