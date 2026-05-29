/**
 * Historical funnel stages — dependency leaf.
 * Pure constants/types only (no engine imports).
 */

export type HistoricalFunnelStageKey =
  | "participation"
  | "training"
  | "qualification"
  | "award"
  | "acceptance"
  | "international";

export type HistoricalFunnelStage = {
  key: HistoricalFunnelStageKey;
  labelAr: string;
  labelEn: string;
  terminal?: boolean;
};

/** Ordered pipeline — ISEF is terminal only (not a transition source). */
export const HISTORICAL_FUNNEL_STAGES: readonly HistoricalFunnelStage[] = [
  { key: "participation", labelAr: "مشاركة", labelEn: "Participation" },
  { key: "training", labelAr: "تدريب", labelEn: "Training" },
  { key: "qualification", labelAr: "تأهل", labelEn: "Qualification" },
  { key: "award", labelAr: "تتويج", labelEn: "Awards" },
  { key: "acceptance", labelAr: "قبول", labelEn: "Acceptance" },
  {
    key: "international",
    labelAr: "دولي / آيسف",
    labelEn: "International / ISEF",
    terminal: true,
  },
] as const;

export const STAGE_ORDER: readonly HistoricalFunnelStageKey[] =
  HISTORICAL_FUNNEL_STAGES.map((s) => s.key);

export type TransitionPairKey =
  | "participation_training"
  | "training_qualification"
  | "qualification_award"
  | "award_acceptance"
  | "acceptance_international";

export type FunnelTransitionPair = {
  key: TransitionPairKey;
  from: HistoricalFunnelStageKey;
  to: HistoricalFunnelStageKey;
  labelAr: string;
  labelEn: string;
};

export const FUNNEL_TRANSITION_PAIRS: readonly FunnelTransitionPair[] = [
  {
    key: "participation_training",
    from: "participation",
    to: "training",
    labelAr: "مشاركة → تدريب",
    labelEn: "Participation → Training",
  },
  {
    key: "training_qualification",
    from: "training",
    to: "qualification",
    labelAr: "تدريب → تأهل",
    labelEn: "Training → Qualification",
  },
  {
    key: "qualification_award",
    from: "qualification",
    to: "award",
    labelAr: "تأهل → تتويج",
    labelEn: "Qualification → Awards",
  },
  {
    key: "award_acceptance",
    from: "award",
    to: "acceptance",
    labelAr: "تتويج → قبول",
    labelEn: "Awards → Acceptance",
  },
  {
    key: "acceptance_international",
    from: "acceptance",
    to: "international",
    labelAr: "قبول → دولي",
    labelEn: "Acceptance → International",
  },
] as const;

/** Runtime guard — logs instead of crashing when stages failed to initialize. */
export const isFunnelStagesReady = (): boolean => {
  if (HISTORICAL_FUNNEL_STAGES.length > 0) return true;
  if (typeof process !== "undefined" && process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.info("[FUNNEL_INIT_ERROR]", {
      source: "historical-funnel-stages",
      note: "HISTORICAL_FUNNEL_STAGES is empty — check import chain",
    });
  }
  return false;
};
