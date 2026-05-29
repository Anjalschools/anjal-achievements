/**
 * Historical competition intelligence — outcome-centric narratives & dominance.
 */

import type { HistoricalYearSlice } from "@/lib/analytics/historical-comparison-fetch";
import type {
  ActivityFamilyDef,
  HistoricalTableNarrative,
} from "@/lib/analytics/historical-comparison-table-engine";
import {
  resolveHistoricalOutcomeGraph,
  type HistoricalOutcomeGap,
} from "@/lib/analytics/historical-results-resolution-engine";
import type { HistoricalOutcomeGraph } from "@/lib/analytics/historical-outcome-model";
import { normalizeDecimal } from "@/lib/analytics/analytics-number-formatting";

export type CompetitionHistoricalInsight = {
  familyKey: string;
  strengthScore: number;
  awardDensity: number;
  peakYear: number;
  troughYear: number;
  dominanceAr: string;
  dominanceEn: string;
  volatility: number;
};

export const analyzeCompetitionHistorical = (
  family: ActivityFamilyDef,
  slices: HistoricalYearSlice[]
): CompetitionHistoricalInsight => {
  const graph = resolveHistoricalOutcomeGraph(family.key, slices);
  const nodes = graph.nodes;

  let peakYear = nodes[0]?.year ?? 0;
  let troughYear = nodes[0]?.year ?? 0;
  let peakStrength = -1;
  let troughStrength = Infinity;

  for (const n of nodes) {
    if (n.metrics.competitionStrength > peakStrength) {
      peakStrength = n.metrics.competitionStrength;
      peakYear = n.year;
    }
    if (n.metrics.competitionStrength < troughStrength) {
      troughStrength = n.metrics.competitionStrength;
      troughYear = n.year;
    }
  }

  const densities = nodes.map((n) => n.metrics.awardDensity);
  const avgDensity = densities.length
    ? densities.reduce((s, d) => s + d, 0) / densities.length
    : 0;
  const volatility =
    densities.length >= 2
      ? normalizeDecimal(
          Math.max(...densities) - Math.min(...densities),
          1
        )
      : 0;

  return {
    familyKey: family.key,
    strengthScore: peakStrength,
    awardDensity: normalizeDecimal(avgDensity, 1),
    peakYear,
    troughYear,
    dominanceAr: `ذروة النتائج ${peakYear} — كثافة تتويج ${normalizeDecimal(avgDensity, 1)}%`,
    dominanceEn: `Results peak ${peakYear} — award density ${normalizeDecimal(avgDensity, 1)}%`,
    volatility,
  };
};

export const buildCompetitionHistoricalNarratives = (
  family: ActivityFamilyDef,
  slices: HistoricalYearSlice[],
  gap?: HistoricalOutcomeGap
): HistoricalTableNarrative[] => {
  const graph = resolveHistoricalOutcomeGraph(family.key, slices);
  const insight = analyzeCompetitionHistorical(family, slices);
  const narratives: HistoricalTableNarrative[] = [];

  const last = graph.nodes[graph.nodes.length - 1];
  const first = graph.nodes[0];

  if (last && last.metrics.awardDensity >= 15) {
    narratives.push({
      id: "award_density_high",
      priority: 92,
      bodyAr: `${family.labelAr} يمتلك أعلى كثافة تتويج (${last.metrics.awardDensity}%) في ${last.year}.`,
      bodyEn: `${family.labelEn} shows top award density (${last.metrics.awardDensity}%) in ${last.year}.`,
    });
  }

  if (first && last && first.metrics.gold > last.metrics.gold && first.metrics.gold > 0) {
    narratives.push({
      id: "gold_decline",
      priority: 88,
      bodyAr: `${family.labelAr} شهد تراجعًا في الذهبية من ${first.year} إلى ${last.year}.`,
      bodyEn: `${family.labelEn} saw a decline in gold medals from ${first.year} to ${last.year}.`,
    });
  }

  if (last && last.metrics.qualificationRate != null && last.metrics.qualificationRate >= 20) {
    narratives.push({
      id: "qualification_strength",
      priority: 86,
      bodyAr: `${family.labelAr} يحقق معدل تأهل ${last.metrics.qualificationRate}% في ${last.year}.`,
      bodyEn: `${family.labelEn} achieves ${last.metrics.qualificationRate}% qualification rate in ${last.year}.`,
    });
  }

  if (family.tableType === "standardized_testing" && last && last.metrics.competitionStrength >= 40) {
    narratives.push({
      id: "testing_quality",
      priority: 84,
      bodyAr: `${family.labelAr} يحقق أعلى جودة نتائج ضمن النطاق (${last.metrics.competitionStrength}/100).`,
      bodyEn: `${family.labelEn} delivers the strongest outcome quality in scope (${last.metrics.competitionStrength}/100).`,
    });
  }

  narratives.push({
    id: "dominance",
    priority: 70,
    bodyAr: insight.dominanceAr,
    bodyEn: insight.dominanceEn,
  });

  if (gap?.messageAr) {
    narratives.push({
      id: "outcome_gap_notice",
      priority: 95,
      bodyAr: gap.messageAr,
      bodyEn: gap.messageEn ?? gap.messageAr,
    });
  }

  return narratives.sort((a, b) => b.priority - a.priority);
};

export const compareFamiliesByAwardDensity = (
  families: ActivityFamilyDef[],
  slices: HistoricalYearSlice[]
): ActivityFamilyDef[] =>
  [...families].sort((a, b) => {
    const ga = resolveHistoricalOutcomeGraph(a.key, slices);
    const gb = resolveHistoricalOutcomeGraph(b.key, slices);
    const da = ga.nodes.reduce((s, n) => s + n.metrics.awardDensity, 0);
    const db = gb.nodes.reduce((s, n) => s + n.metrics.awardDensity, 0);
    return db - da;
  });
