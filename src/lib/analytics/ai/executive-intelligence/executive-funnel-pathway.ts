/**
 * Legal funnel pathway labels — ordered stages only, no impossible sequences in display.
 */
import { HISTORICAL_FUNNEL_STAGES } from "@/lib/analytics/shared/historical-funnel-stages";
import type { NormalizedFunnelStages } from "@/lib/analytics/shared/historical-funnel-types";

export const formatOrderedFunnelPathway = (
  stages: NormalizedFunnelStages,
  isAr: boolean
): string => {
  const labels: string[] = [];
  for (const stage of HISTORICAL_FUNNEL_STAGES) {
    const count = stages[stage.key] ?? 0;
    if (count <= 0) {
      if (labels.length > 0) break;
      continue;
    }
    labels.push(isAr ? stage.labelAr : stage.labelEn);
  }
  return labels.join(" → ");
};
