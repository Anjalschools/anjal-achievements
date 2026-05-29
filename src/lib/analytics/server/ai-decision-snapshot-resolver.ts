import "server-only";

import type { AiDecisionEngineResult } from "@/lib/analytics/ai/ai-decision-schema";
import type { ExecutiveAnalyticsSnapshotPayload } from "@/lib/analytics/server/analytics-snapshot-schema";
import { buildAiExecutiveDecisions } from "@/lib/analytics/ai/ai-decision-engine";
import { buildAiDecisionSnapshotFromExecutivePayload } from "@/lib/analytics/server/ai-decision-snapshot-engine";
import { extractAiDecisionBundle } from "@/lib/analytics/server/ai-decision-snapshot-store";
import type { ParticipationAnalyticsPayload } from "@/lib/achievement-participation-analytics";

export const resolveAiDecisionBundle = (input: {
  snapshotPayload?: ExecutiveAnalyticsSnapshotPayload | null;
  general: ParticipationAnalyticsPayload | null;
  bypassSnapshot?: boolean;
}): AiDecisionEngineResult => {
  if (!input.bypassSnapshot && input.snapshotPayload?.aiDecisionBundle) {
    return input.snapshotPayload.aiDecisionBundle;
  }

  const embedded = extractAiDecisionBundle(input.snapshotPayload as unknown as Record<string, unknown>);
  if (!input.bypassSnapshot && embedded) return embedded;

  if (!input.snapshotPayload) {
    return buildAiExecutiveDecisions({
      filterFingerprint: "inline",
      general: input.general,
      insights: { insights: [], hasData: false },
      narratives: [],
      strategicInsights: [],
      useCache: false,
    });
  }

  return buildAiDecisionSnapshotFromExecutivePayload(input.snapshotPayload, input.general);
};

