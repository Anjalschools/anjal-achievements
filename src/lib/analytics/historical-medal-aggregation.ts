/**
 * Medal aggregation from participation rows + result semantics + chart/KPI fallbacks.
 */

import type { ParticipationActivityRow } from "@/lib/achievement-participation-analytics";
import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";

export type AggregatedMedals = {
  gold: number;
  silver: number;
  bronze: number;
  total: number;
  honorableMention: number;
  finalist: number;
  fromRowCounts: number;
  fromSemanticInference: number;
  fromChartFallback: number;
};

const resultText = (row: ParticipationActivityRow): string =>
  `${row.participationResultKey ?? ""} ${row.participationResultAr ?? ""} ${row.participationResultEn ?? ""}`.toLowerCase();

const inferMedalHints = (row: ParticipationActivityRow): { gold: number; silver: number; bronze: number } => {
  const t = resultText(row);
  let gold = 0;
  let silver = 0;
  let bronze = 0;
  if (/gold|ذهب|medal:gold/i.test(t)) gold += 1;
  if (/silver|فض|medal:silver/i.test(t)) silver += 1;
  if (/bronze|برونز|medal:bronze/i.test(t)) bronze += 1;
  if (/medal|ميدال|award|جائزة|تتويج/i.test(t) && gold + silver + bronze === 0) {
    gold += 1;
  }
  return { gold, silver, bronze };
};

const chartMedalCounts = (
  charts: ParticipationAnalyticsPayload["charts"] | undefined
): { gold: number; silver: number; bronze: number } => {
  const items = charts?.resultOutcomeCompare ?? [];
  let gold = 0;
  let silver = 0;
  let bronze = 0;
  for (const item of items) {
    const label = `${item.labelAr ?? ""} ${item.labelEn ?? ""} ${item.key ?? ""}`.toLowerCase();
    const c = Number(item.count ?? 0);
    if (/gold|ذهب/.test(label)) gold += c;
    else if (/silver|فض/.test(label)) silver += c;
    else if (/bronze|برونز/.test(label)) bronze += c;
    else if (/medal|ميدال/.test(label)) gold += c;
  }
  return { gold, silver, bronze };
};

export const aggregateMedalsFromRows = (
  rows: ParticipationActivityRow[],
  chartFallback?: ParticipationAnalyticsPayload["charts"]
): AggregatedMedals => {
  let gold = 0;
  let silver = 0;
  let bronze = 0;
  let honorableMention = 0;
  let finalist = 0;
  let fromSemanticInference = 0;

  for (const row of rows) {
    const g = Number(row.goldMedalCount ?? 0);
    const s = Number(row.silverMedalCount ?? 0);
    const b = Number(row.bronzeMedalCount ?? 0);
    gold += g;
    silver += s;
    bronze += b;

    const hints = inferMedalHints(row);
    if (g === 0 && hints.gold > 0) {
      gold += Math.min(row.totalParticipations || 1, hints.gold);
      fromSemanticInference += 1;
    }
    if (s === 0 && hints.silver > 0) {
      silver += Math.min(row.totalParticipations || 1, hints.silver);
      fromSemanticInference += 1;
    }
    if (b === 0 && hints.bronze > 0) {
      bronze += Math.min(row.totalParticipations || 1, hints.bronze);
      fromSemanticInference += 1;
    }

    const t = resultText(row);
    if (/honor|mention|تقدير|شكر/i.test(t)) honorableMention += 1;
    if (/final|نهائي|finalist/i.test(t)) finalist += 1;
  }

  const fromRowCounts = gold + silver + bronze;
  let fromChartFallback = 0;
  if (fromRowCounts === 0 && chartFallback) {
    const ch = chartMedalCounts(chartFallback);
    gold = ch.gold;
    silver = ch.silver;
    bronze = ch.bronze;
    fromChartFallback = gold + silver + bronze;
  }

  return {
    gold,
    silver,
    bronze,
    total: gold + silver + bronze,
    honorableMention,
    finalist,
    fromRowCounts,
    fromSemanticInference,
    fromChartFallback,
  };
};
