/**
 * Historical medal intelligence — weights, density, honorable mention proxy.
 */

import type { ParticipationActivityRow } from "@/lib/achievement-participation-analytics";

export type MedalTier = "gold" | "silver" | "bronze" | "honorable" | "finalist" | "qualified" | "accepted";

export const MEDAL_AWARD_WEIGHTS: Record<"gold" | "silver" | "bronze", number> = {
  gold: 3,
  silver: 2,
  bronze: 1,
};

export type MedalIntelligence = {
  gold: number;
  silver: number;
  bronze: number;
  total: number;
  weightedTotal: number;
  density: number;
  honorableMention: number;
  finalist: number;
  qualified: number;
  accepted: number;
};

const resultSuggestsHonorable = (row: ParticipationActivityRow): boolean =>
  /honor|mention|تقدير|شكر/i.test(
    `${row.participationResultKey} ${row.participationResultAr} ${row.participationResultEn}`
  );

const resultSuggestsFinalist = (row: ParticipationActivityRow): boolean =>
  /final|نهائي|finalist/i.test(
    `${row.participationResultKey} ${row.participationResultAr} ${row.participationResultEn}`
  );

export const extractMedalIntelligence = (rows: ParticipationActivityRow[]): MedalIntelligence => {
  let gold = 0;
  let silver = 0;
  let bronze = 0;
  let honorableMention = 0;
  let finalist = 0;
  let qualified = 0;
  let accepted = 0;

  for (const r of rows) {
    gold += r.goldMedalCount;
    silver += r.silverMedalCount;
    bronze += r.bronzeMedalCount;
    qualified += r.nominationCount;
    accepted += r.approvedAchievements;
    if (resultSuggestsHonorable(r)) honorableMention += 1;
    if (resultSuggestsFinalist(r)) finalist += 1;
  }

  const total = gold + silver + bronze;
  const participation = rows.reduce((s, r) => s + r.totalParticipations, 0);
  const weightedTotal =
    gold * MEDAL_AWARD_WEIGHTS.gold +
    silver * MEDAL_AWARD_WEIGHTS.silver +
    bronze * MEDAL_AWARD_WEIGHTS.bronze;
  const density = participation > 0 ? Math.round((total / participation) * 1000) / 10 : 0;

  return {
    gold,
    silver,
    bronze,
    total,
    weightedTotal,
    density,
    honorableMention,
    finalist,
    qualified,
    accepted,
  };
};

export const hasMedalSignal = (rows: ParticipationActivityRow[]): boolean => {
  const m = extractMedalIntelligence(rows);
  return m.total > 0 || m.qualified > 0 || m.finalist > 0;
};

export const medalMetricValue = (
  rows: ParticipationActivityRow[],
  tier: MedalTier
): number => {
  const m = extractMedalIntelligence(rows);
  if (tier === "gold") return m.gold;
  if (tier === "silver") return m.silver;
  if (tier === "bronze") return m.bronze;
  if (tier === "qualified") return m.qualified;
  if (tier === "accepted") return m.accepted;
  if (tier === "finalist") return m.finalist;
  if (tier === "honorable") return m.honorableMention;
  return m.total;
};
