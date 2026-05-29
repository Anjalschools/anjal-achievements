/**
 * competition-history-engine.ts
 * Extracts competition-specific history and transitions.
 */
import type { RawActivityRecord } from "./student-activity-loader";

export type CompetitionHistoryEntry = {
  activityKey: string;
  activityLabelAr: string;
  activityLabelEn: string;
  yearsParticipated: number[];
  bestOutcomeKey: string;
  bestQualityScore: number;
  latestYear: number;
  totalParticipations: number;
  trajectory: "improving" | "stable" | "declining" | "single";
};

export type CompetitionTransition = {
  fromKey: string;
  toKey: string;
  fromYear: number;
  toYear: number;
};

export type CompetitionHistory = {
  entries: CompetitionHistoryEntry[];
  transitions: CompetitionTransition[];
};

const QUALITY: Record<string, number> = {
  "medal:gold": 100, "medal:silver": 80, "medal:bronze": 65,
  "rank:first": 95, "rank:second": 85, "rank:third": 75,
  nomination: 50, special_award: 70, participation: 20,
};
const q = (key: string) => QUALITY[key] ?? QUALITY[key.split(":")[0]!] ?? 20;

export const buildCompetitionHistory = (
  records: RawActivityRecord[]
): CompetitionHistory => {
  const byKey = new Map<string, RawActivityRecord[]>();
  for (const r of records) {
    if (!byKey.has(r.canonicalActivityKey)) byKey.set(r.canonicalActivityKey, []);
    byKey.get(r.canonicalActivityKey)!.push(r);
  }

  const entries: CompetitionHistoryEntry[] = [];
  for (const [key, recs] of byKey) {
    const sorted = [...recs].sort((a, b) => a.achievementYear - b.achievementYear);
    const years = [...new Set(sorted.map((r) => r.achievementYear))];
    const scores = sorted.map((r) => q(r.outcomeKey));
    const best = Math.max(...scores);
    const bestRec = sorted.find((r) => q(r.outcomeKey) === best)!;

    let trajectory: CompetitionHistoryEntry["trajectory"] = "single";
    if (scores.length >= 2) {
      const first = scores[0]!;
      const last  = scores[scores.length - 1]!;
      trajectory = last > first ? "improving" : last < first ? "declining" : "stable";
    }

    entries.push({
      activityKey: key,
      activityLabelAr: recs[0]!.activityLabelAr,
      activityLabelEn: recs[0]!.activityLabelEn,
      yearsParticipated: years,
      bestOutcomeKey: bestRec.outcomeKey,
      bestQualityScore: best,
      latestYear: years[years.length - 1]!,
      totalParticipations: recs.length,
      trajectory,
    });
  }

  // build transitions: for each year, record first-time entries
  const byYear = new Map<number, string[]>();
  for (const r of records) {
    if (!byYear.has(r.achievementYear)) byYear.set(r.achievementYear, []);
    if (!byYear.get(r.achievementYear)!.includes(r.canonicalActivityKey))
      byYear.get(r.achievementYear)!.push(r.canonicalActivityKey);
  }

  const transitions: CompetitionTransition[] = [];
  const sortedYears = [...byYear.keys()].sort((a, b) => a - b);
  for (let i = 1; i < sortedYears.length; i++) {
    const prevYear = sortedYears[i - 1]!;
    const currYear = sortedYears[i]!;
    const prevKeys = byYear.get(prevYear)!;
    const currKeys = byYear.get(currYear)!;
    for (const newKey of currKeys) {
      if (!prevKeys.includes(newKey)) {
        // pair with the best performing prior activity
        const bestPrev = [...prevKeys].sort(
          (a, b) =>
            q(byKey.get(b)?.[0]?.outcomeKey ?? "") -
            q(byKey.get(a)?.[0]?.outcomeKey ?? "")
        )[0];
        if (bestPrev) {
          transitions.push({
            fromKey: bestPrev,
            toKey: newKey,
            fromYear: prevYear,
            toYear: currYear,
          });
        }
      }
    }
  }

  return { entries, transitions };
};
