import "server-only";

import { buildAiExecutiveDecisions, type AiDecisionEngineInput } from "@/lib/analytics/ai/ai-decision-engine";
import type { AiDecisionEngineResult } from "@/lib/analytics/ai/ai-decision-schema";
import type { ExecutiveAnalyticsSnapshotPayload } from "@/lib/analytics/server/analytics-snapshot-schema";
import { buildEducationalRecommendations } from "@/lib/analytics/analytics-recommendation-engine";

export const buildAiDecisionSnapshotFromExecutivePayload = (
  payload: ExecutiveAnalyticsSnapshotPayload,
  general: AiDecisionEngineInput["general"]
): AiDecisionEngineResult => {
  const recBundle = general ? buildEducationalRecommendations(general, "participation") : null;

  return buildAiExecutiveDecisions({
    filterFingerprint: payload.filterFingerprint,
    filterScope: payload.filterFingerprint,
    general,
    insights: payload.insights,
    narratives: payload.narratives,
    strategicInsights: payload.strategicInsights,
    recommendations: recBundle?.recommendations,
    kpiStrip: payload.kpiStrip,
    useCache: false,
  });
};
