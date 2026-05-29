/**
 * activity-timeline-builder.ts
 * Builds a chronological achievement timeline from raw records.
 */
import type { RawActivityRecord } from "./student-activity-loader";

export type TimelineEvent = {
  year: number;
  activityKey: string;
  activityLabelAr: string;
  activityLabelEn: string;
  outcomeKey: string;
  medalType: string | null;
  rank: string | null;
  achievementLevel: string;
  qualityScore: number; // 0–100
};

export type ActivityTimeline = {
  userId: string;
  events: TimelineEvent[];           // sorted asc
  firstYear: number | null;
  lastYear: number | null;
  yearSpan: number;
  activeYears: number[];
};

const OUTCOME_QUALITY: Record<string, number> = {
  "medal:gold": 100,
  "medal:silver": 80,
  "medal:bronze": 65,
  "rank:first": 95,
  "rank:second": 85,
  "rank:third": 75,
  "rank:fourth": 68,
  "rank:fifth": 62,
  "rank:top_10": 55,
  "rank:finalist": 52,
  nomination: 50,
  qualification: 48,
  special_award: 70,
  completion: 35,
  participation: 20,
};

const qualityFor = (outcomeKey: string): number =>
  OUTCOME_QUALITY[outcomeKey] ??
  OUTCOME_QUALITY[outcomeKey.split(":")[0]!] ??
  20;

export const buildActivityTimeline = (
  userId: string,
  records: RawActivityRecord[]
): ActivityTimeline => {
  const events: TimelineEvent[] = records
    .filter((r) => r.achievementYear >= 2010 && r.achievementYear <= 2040)
    .map((r) => ({
      year: r.achievementYear,
      activityKey: r.canonicalActivityKey,
      activityLabelAr: r.activityLabelAr,
      activityLabelEn: r.activityLabelEn,
      outcomeKey: r.outcomeKey,
      medalType: r.medalType,
      rank: r.rank,
      achievementLevel: r.achievementLevel,
      qualityScore: qualityFor(r.outcomeKey),
    }))
    .sort((a, b) => a.year - b.year || b.qualityScore - a.qualityScore);

  const activeYears = [...new Set(events.map((e) => e.year))].sort((a, b) => a - b);
  const firstYear = activeYears[0] ?? null;
  const lastYear = activeYears[activeYears.length - 1] ?? null;

  return {
    userId,
    events,
    firstYear,
    lastYear,
    yearSpan: firstYear && lastYear ? lastYear - firstYear + 1 : 0,
    activeYears,
  };
};
