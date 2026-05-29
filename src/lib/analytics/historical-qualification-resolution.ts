/**
 * Qualification / nomination / acceptance resolution from rows + charts.
 */

import type { ParticipationActivityRow } from "@/lib/achievement-participation-analytics";
import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";

export type ResolvedQualification = {
  qualified: number;
  nominated: number;
  accepted: number;
  finalists: number;
  advancedToNextStage: number;
  qualificationRate: number | null;
  fromChartFallback: number;
};

const resultText = (row: ParticipationActivityRow): string =>
  `${row.participationResultKey ?? ""} ${row.participationResultAr ?? ""} ${row.participationResultEn ?? ""}`.toLowerCase();

const chartQualificationCounts = (
  charts: ParticipationAnalyticsPayload["charts"] | undefined
): { nomination: number; acceptance: number } => {
  let nomination = 0;
  let acceptance = 0;
  for (const item of charts?.resultOutcomeCompare ?? []) {
    const label = `${item.labelAr ?? ""} ${item.labelEn ?? ""} ${item.key ?? ""}`.toLowerCase();
    const c = Number(item.count ?? 0);
    if (/nomination|ترشيح|qualif|تأهل/i.test(label)) nomination += c;
    if (/accept|قبول|pass|اجتياز/i.test(label)) acceptance += c;
  }
  return { nomination, acceptance };
};

export const resolveQualificationFromRows = (
  rows: ParticipationActivityRow[],
  participants: number,
  charts?: ParticipationAnalyticsPayload["charts"]
): ResolvedQualification => {
  let nominated = 0;
  let accepted = 0;
  let finalists = 0;
  let advancedToNextStage = 0;

  for (const row of rows) {
    nominated += Number(row.nominationCount ?? 0);
    accepted += Number(row.approvedAchievements ?? 0);
    const t = resultText(row);
    if (/final|نهائي|finalist/i.test(t)) finalists += 1;
    if (/advanced|تأهل|qualified|قبول|accept/i.test(t)) advancedToNextStage += 1;
    if (Number(row.nominationCount ?? 0) === 0 && /nomination|ترشيح/i.test(t)) {
      nominated += Math.min(1, row.totalParticipations || 1);
    }
  }

  let fromChartFallback = 0;
  if (nominated === 0 && accepted === 0 && charts) {
    const ch = chartQualificationCounts(charts);
    nominated = ch.nomination;
    accepted = ch.acceptance;
    fromChartFallback = nominated + accepted;
  }

  const qualified = Math.max(nominated, finalists);
  const qualificationRate =
    participants > 0 ? Math.round((qualified / participants) * 1000) / 10 : null;

  return {
    qualified,
    nominated,
    accepted,
    finalists,
    advancedToNextStage,
    qualificationRate,
    fromChartFallback,
  };
};
