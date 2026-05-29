/**
 * Historical funnel types — dependency leaf (types only).
 */

import type {
  HistoricalFunnelStageKey,
  TransitionPairKey,
} from "@/lib/analytics/shared/historical-funnel-stages";

export type NormalizedFunnelStages = Record<HistoricalFunnelStageKey, number>;

export type FunnelTransitionMetrics = {
  key: TransitionPairKey;
  from: HistoricalFunnelStageKey;
  to: HistoricalFunnelStageKey;
  sourceCount: number;
  targetCount: number;
  conversionRate: number;
  retention: number;
  leakageRate: number;
  valid: boolean;
};

export type FunnelTerminationReason =
  | "insufficient_data"
  | "no_progression"
  | "incompatible_filters"
  | "sparse_historical_data"
  | "complete";

export type YearFunnelSnapshot = {
  year: number;
  stages: NormalizedFunnelStages;
  displayStages: NormalizedFunnelStages;
  transitions: FunnelTransitionMetrics[];
  pipelineStrength: number;
  terminatedAtStage: HistoricalFunnelStageKey | null;
  terminationReason: FunnelTerminationReason;
};

export type HistoricalFunnelIntelligence = {
  sufficient: boolean;
  snapshots: YearFunnelSnapshot[];
  strongestTransition: FunnelTransitionMetrics | null;
  weakestTransition: FunnelTransitionMetrics | null;
  bottleneckStage: HistoricalFunnelStageKey | null;
  bottleneckSeverity: number;
  funnelLeakage: number;
  yoyQualityDelta: number;
  funnelConfidence: number;
  dataCompleteness: number;
  funnelTerminationReason: FunnelTerminationReason;
  narrativeAr: string;
  narrativeEn: string;
};
