/**
 * Funnel narrative & transition semantic validation.
 */

import type {
  FunnelTransitionMetrics,
  HistoricalFunnelIntelligence,
} from "@/lib/analytics/shared/historical-funnel-types";
import type { TransitionPairKey } from "@/lib/analytics/shared/historical-funnel-stages";

const ALLOWED_TRANSITIONS: TransitionPairKey[] = [
  "participation_training",
  "training_qualification",
  "qualification_award",
  "award_acceptance",
  "acceptance_international",
];

export const isValidFunnelTransition = (t: FunnelTransitionMetrics): boolean => {
  if (!t.valid) return false;
  if (!ALLOWED_TRANSITIONS.includes(t.key)) return false;
  if (t.sourceCount < 3 || t.targetCount <= 0) return false;
  if (t.to === "international" && t.from !== "acceptance") return false;
  return true;
};

export const buildValidatedFunnelNarrative = (
  funnel: HistoricalFunnelIntelligence | null | undefined
): { bodyAr: string; bodyEn: string } | null => {
  if (!funnel?.sufficient) return null;

  const strongest = funnel.strongestTransition;
  const weakest = funnel.weakestTransition;
  if (!strongest || !weakest) return null;
  if (!isValidFunnelTransition(strongest) || !isValidFunnelTransition(weakest)) {
    return {
      bodyAr: "مسار المسابقة التاريخي يحتاج مزيدًا من البيانات لتحليل الانتقالات بدقة.",
      bodyEn: "The historical competition pipeline needs more data for reliable transition analysis.",
    };
  }

  return {
    bodyAr: funnel.narrativeAr,
    bodyEn: funnel.narrativeEn,
  };
};
