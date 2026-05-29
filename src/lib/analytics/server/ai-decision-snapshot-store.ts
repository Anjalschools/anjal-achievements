import "server-only";

import type { AiDecisionEngineResult } from "@/lib/analytics/ai/ai-decision-schema";

/** AI decisions are embedded in ExecutiveAnalyticsSnapshot.payload.aiDecisionBundle */
export const extractAiDecisionBundle = (
  payload: Record<string, unknown> | null | undefined
): AiDecisionEngineResult | null => {
  if (!payload || typeof payload !== "object") return null;
  const bundle = (payload as { aiDecisionBundle?: AiDecisionEngineResult }).aiDecisionBundle;
  return bundle?.bundle?.decisions ? bundle : null;
};
