import type { ImprovementAction, ImprovementTrackingRow } from "@/lib/school-improvement/school-improvement-types";

/** Snapshot-based tracking — all actions default to proposed (no auto-execution). */
export const buildImprovementTracking = (
  actions: ImprovementAction[],
  generatedAt: string
): ImprovementTrackingRow[] =>
  actions.map((action) => ({
    actionId: action.id,
    titleAr: action.recommendationAr,
    titleEn: action.recommendationEn,
    status: action.trackingStatus,
    ownerLabelAr: action.ownerLabelAr,
    priority: action.priority,
    timeline: action.timeline,
    lastUpdated: generatedAt,
  }));
