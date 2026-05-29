/**
 * Historical Funnel Intelligence — stable pipeline retention & bottleneck semantics.
 */

import type { HistoricalYearSlice } from "@/lib/analytics/historical-comparison-fetch";
import { normalizeDecimal, ratioToPercentage } from "@/lib/analytics/analytics-number-formatting";
import { readHistoricalCache, writeHistoricalCache } from "@/lib/analytics/analytics-historical-cache-v2";
import {
  FUNNEL_TRANSITION_PAIRS,
  HISTORICAL_FUNNEL_STAGES,
  STAGE_ORDER,
  isFunnelStagesReady,
  type HistoricalFunnelStageKey,
} from "@/lib/analytics/shared/historical-funnel-stages";
import type {
  FunnelTerminationReason,
  FunnelTransitionMetrics,
  HistoricalFunnelIntelligence,
  NormalizedFunnelStages,
  YearFunnelSnapshot,
} from "@/lib/analytics/shared/historical-funnel-types";
import { validateTransitionLegality } from "@/lib/analytics/shared/funnel-utils";

export type {
  HistoricalFunnelStageKey,
  HistoricalFunnelStage,
  TransitionPairKey,
} from "@/lib/analytics/shared/historical-funnel-stages";

export type {
  NormalizedFunnelStages,
  FunnelTransitionMetrics,
  FunnelTerminationReason,
  YearFunnelSnapshot,
  HistoricalFunnelIntelligence,
} from "@/lib/analytics/shared/historical-funnel-types";

export {
  HISTORICAL_FUNNEL_STAGES,
  FUNNEL_TRANSITION_PAIRS,
  STAGE_ORDER,
} from "@/lib/analytics/shared/historical-funnel-stages";

const MIN_STAGE_COUNT = 3;
const MIN_YEARS = 2;

const emptyFunnelResult = (
  reason: FunnelTerminationReason,
  narrativeAr: string,
  narrativeEn: string,
  partial?: Partial<HistoricalFunnelIntelligence>
): HistoricalFunnelIntelligence => ({
  sufficient: false,
  snapshots: [],
  strongestTransition: null,
  weakestTransition: null,
  bottleneckStage: null,
  bottleneckSeverity: 0,
  funnelLeakage: 0,
  yoyQualityDelta: 0,
  funnelConfidence: 0,
  dataCompleteness: 0,
  funnelTerminationReason: reason,
  narrativeAr,
  narrativeEn,
  ...partial,
});

const safeCount = (n: number): number =>
  typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.round(n) : 0;

/** Normalize raw payload into monotonic pipeline counts (non-increasing downstream capped). */
export const normalizeFunnelStages = (slice: HistoricalYearSlice): NormalizedFunnelStages => {
  const t = slice.payload.table;
  const part = safeCount(slice.payload.kpis.totalParticipations);
  const nom = safeCount(slice.payload.kpis.nominationCount);
  const acc = safeCount(t.reduce((s, r) => s + r.approvedAchievements, 0));
  const train = safeCount(t.reduce((s, r) => s + r.rankCount, 0));
  const olymp = safeCount(
    t
      .filter((r) => /olympiad|أولمبياد/i.test(r.activityLabelEn + r.activityLabelAr))
      .reduce((s, r) => s + r.totalParticipations, 0)
  );
  const isef = safeCount(
    t
      .filter((r) => /isef|آيسف|ibdaa|إبداع/i.test(r.activityLabelEn + r.activityLabelAr))
      .reduce((s, r) => s + r.totalParticipations, 0)
  );

  const medals = safeCount(t.reduce((s, r) => s + r.goldMedalCount + r.silverMedalCount + r.bronzeMedalCount, 0));

  let participation = part > 0 ? part : 0;
  let training = train > 0 ? train : 0;
  let qualification = nom > 0 ? nom : 0;
  let award = medals > 0 ? medals : olymp > 0 ? olymp : 0;
  let acceptance = acc > 0 ? acc : 0;
  let international = isef > 0 ? isef : 0;

  if (training === 0 && participation > 0) {
    training = Math.min(participation, Math.round(participation * 0.65));
  }
  if (qualification === 0 && training > 0) {
    qualification = Math.min(training, Math.round(training * 0.75));
  }
  if (award === 0 && qualification > 0) {
    award = Math.min(qualification, Math.round(qualification * 0.55));
  }

  participation = Math.max(participation, training, qualification, award, acceptance, international, 0);
  training = Math.min(training, participation);
  qualification = Math.min(qualification, training || participation);
  award = Math.min(award, qualification || training);
  acceptance = Math.min(acceptance, award || qualification);
  international = Math.min(international, acceptance);

  return {
    participation,
    training,
    qualification,
    award,
    acceptance,
    international,
  };
};

const buildTransition = (
  pair: (typeof FUNNEL_TRANSITION_PAIRS)[number],
  stages: NormalizedFunnelStages
): FunnelTransitionMetrics => {
  const sourceCount = stages[pair.from] ?? 0;
  const targetCount = stages[pair.to] ?? 0;
  const valid = sourceCount >= MIN_STAGE_COUNT && targetCount > 0;
  const retention = valid ? ratioToPercentage(targetCount, sourceCount) : 0;
  const conversionRate = retention;
  const leakageRate = valid ? normalizeDecimal(100 - retention, 1) : 100;

  return {
    key: pair.key,
    from: pair.from,
    to: pair.to,
    sourceCount,
    targetCount,
    conversionRate,
    retention,
    leakageRate,
    valid,
  };
};

/** Truncate pipeline at first zero stage — no retention after break. */
export const stopZeroContinuity = (
  stages: NormalizedFunnelStages
): {
  displayStages: NormalizedFunnelStages;
  terminatedAt: HistoricalFunnelStageKey | null;
  reason: FunnelTerminationReason;
} => {
  const display = { ...stages };
  let terminatedAt: HistoricalFunnelStageKey | null = null;

  for (let i = 0; i < STAGE_ORDER.length; i++) {
    const key = STAGE_ORDER[i]!;
    if ((stages[key] ?? 0) <= 0) {
      terminatedAt = key;
      for (let j = i + 1; j < STAGE_ORDER.length; j++) {
        display[STAGE_ORDER[j]!] = 0;
      }
      break;
    }
  }

  const reason: FunnelTerminationReason = terminatedAt
    ? terminatedAt === "participation"
      ? "insufficient_data"
      : "no_progression"
    : "complete";

  if (process.env.NODE_ENV !== "production" && terminatedAt) {
    // eslint-disable-next-line no-console
    console.info("[historical-funnel] stopZeroContinuity", { terminatedAt, reason });
  }

  return { displayStages: display, terminatedAt, reason };
};

const buildTransitionsWithZeroStop = (
  stages: NormalizedFunnelStages,
  terminatedAt: HistoricalFunnelStageKey | null
): FunnelTransitionMetrics[] => {
  const out: FunnelTransitionMetrics[] = [];

  for (const pair of FUNNEL_TRANSITION_PAIRS) {
    const fromIdx = STAGE_ORDER.indexOf(pair.from);
    if (terminatedAt) {
      const termIdx = STAGE_ORDER.indexOf(terminatedAt);
      if (fromIdx >= termIdx) {
        out.push({
          ...buildTransition(pair, stages),
          valid: false,
          retention: 0,
          conversionRate: 0,
          leakageRate: 0,
        });
        continue;
      }
    }
    const sourceCount = stages[pair.from] ?? 0;
    const targetCount = stages[pair.to] ?? 0;
    if (sourceCount <= 0 || targetCount <= 0) {
      out.push({
        key: pair.key,
        from: pair.from,
        to: pair.to,
        sourceCount,
        targetCount,
        conversionRate: 0,
        retention: 0,
        leakageRate: 0,
        valid: false,
      });
      continue;
    }
    out.push(buildTransition(pair, stages));
  }

  return out;
};

const rankableTransitions = (transitions: FunnelTransitionMetrics[]): FunnelTransitionMetrics[] =>
  transitions.filter(
    (t) =>
      t.valid &&
      t.to !== "international" &&
      t.sourceCount > 0 &&
      t.targetCount > 0 &&
      validateTransitionLegality(t)
  );

const computeCompleteness = (stages: NormalizedFunnelStages): number => {
  const withData = STAGE_ORDER.filter((k) => (stages[k] ?? 0) >= MIN_STAGE_COUNT).length;
  return normalizeDecimal((withData / STAGE_ORDER.length) * 100, 0);
};

export const buildStableEducationalFunnel = (
  slices: HistoricalYearSlice[]
): HistoricalFunnelIntelligence => {
  const insufficientAr = "لا توجد بيانات كافية لتحليل مسار المسابقة التاريخي.";
  const insufficientEn = "Not enough data to analyze the historical competition pipeline.";

  if (!isFunnelStagesReady()) {
    return emptyFunnelResult("incompatible_filters", insufficientAr, insufficientEn);
  }

  if (slices.length < MIN_YEARS) {
    return emptyFunnelResult("insufficient_data", insufficientAr, insufficientEn);
  }

  const snapshots: YearFunnelSnapshot[] = slices
    .sort((a, b) => a.year - b.year)
    .map((slice) => {
      const stages = normalizeFunnelStages(slice);
      const { displayStages, terminatedAt, reason } = stopZeroContinuity(stages);
      const transitions = buildTransitionsWithZeroStop(displayStages, terminatedAt);
      const validRetentions = transitions.filter((t) => t.valid).map((t) => t.retention);
      const pipelineStrength =
        validRetentions.length > 0
          ? normalizeDecimal(validRetentions.reduce((s, r) => s + r, 0) / validRetentions.length, 1)
          : 0;
      return {
        year: slice.year,
        stages,
        displayStages,
        transitions,
        pipelineStrength,
        terminatedAtStage: terminatedAt,
        terminationReason: reason,
      };
    });

  const latest = snapshots[snapshots.length - 1]!;
  const prev = snapshots[snapshots.length - 2];
  const rankable = rankableTransitions(latest.transitions);

  const dataCompleteness = computeCompleteness(latest.displayStages);
  const terminationReason =
    latest.terminationReason === "complete" && dataCompleteness < 25
      ? "sparse_historical_data"
      : latest.terminationReason;
  const validTransitionCount = latest.transitions.filter((t) => t.valid).length;
  const funnelConfidence = normalizeDecimal(
    Math.min(100, dataCompleteness * 0.5 + (validTransitionCount / FUNNEL_TRANSITION_PAIRS.length) * 50),
    0
  );

  if (rankable.length === 0 || dataCompleteness < 25) {
    return emptyFunnelResult(terminationReason, insufficientAr, insufficientEn, {
      snapshots,
      funnelConfidence,
      dataCompleteness,
    });
  }

  const strongest = rankable.reduce((best, t) => (t.retention > best.retention ? t : best), rankable[0]!);
  const weakest = rankable.reduce((worst, t) => (t.retention < worst.retention ? t : worst), rankable[0]!);

  const bottleneckStage = weakest.to;
  const bottleneckSeverity = weakest.leakageRate;

  const validLeakages = latest.transitions.filter((t) => t.valid).map((t) => t.leakageRate);
  const funnelLeakage =
    validLeakages.length > 0
      ? normalizeDecimal(validLeakages.reduce((s, l) => s + l, 0) / validLeakages.length, 1)
      : 0;

  const yoyQualityDelta = prev
    ? normalizeDecimal(latest.pipelineStrength - prev.pipelineStrength, 1)
    : 0;

  const strongPair = FUNNEL_TRANSITION_PAIRS.find((p) => p.key === strongest.key);
  const weakStage = HISTORICAL_FUNNEL_STAGES.find((s) => s.key === bottleneckStage);

  const narrativeAr = `أقوى انتقال: ${strongPair?.labelAr ?? strongest.from} (${strongest.retention}%). عنق الزجاجة: ${weakStage?.labelAr ?? bottleneckStage} (احتفاظ ${weakest.retention}%).`;
  const narrativeEn = `Strongest transition: ${strongPair?.labelEn ?? strongest.from} (${strongest.retention}% retention). Bottleneck: ${weakStage?.labelEn ?? bottleneckStage} (${weakest.retention}% retention).`;

  return {
    sufficient: true,
    snapshots,
    strongestTransition: strongest,
    weakestTransition: weakest,
    bottleneckStage,
    bottleneckSeverity,
    funnelLeakage,
    yoyQualityDelta,
    funnelConfidence,
    dataCompleteness,
    funnelTerminationReason: terminationReason,
    narrativeAr,
    narrativeEn,
  };
};

/** @deprecated Use buildStableEducationalFunnel — kept for call-site compatibility */
export const buildHistoricalFunnelIntelligence = (
  slices: HistoricalYearSlice[]
): HistoricalFunnelIntelligence | null => {
  if (slices.length < MIN_YEARS) return null;

  const cacheKey = `funnel|${slices.map((s) => s.year).join(",")}|${slices[0]?.payload.kpis.totalParticipations ?? 0}`;
  const cached = readHistoricalCache<HistoricalFunnelIntelligence>("funnel", cacheKey);
  if (cached) return cached;

  const result = buildStableEducationalFunnel(slices);
  writeHistoricalCache("funnel", cacheKey, result);
  return result;
};
