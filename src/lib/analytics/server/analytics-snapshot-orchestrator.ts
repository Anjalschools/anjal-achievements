import "server-only";

import type { ParticipationAnalyticsFilters } from "@/lib/achievement-participation-analytics";
import type { ExecutiveSnapshotGranularity } from "@/models/ExecutiveAnalyticsSnapshot";
import {
  buildExecutiveAnalyticsSnapshot,
  defaultExecutiveSnapshotFilters,
} from "@/lib/analytics/server/analytics-snapshot-engine";
import { upsertExecutiveAnalyticsSnapshot } from "@/lib/analytics/server/analytics-snapshot-store";

export type SnapshotBatchResult = {
  filterFingerprint: string;
  id: string;
  facetMs: number;
  trustIssues: number;
};

export const runExecutiveSnapshotBatch = async (input?: {
  filterSets?: ParticipationAnalyticsFilters[];
  granularity?: ExecutiveSnapshotGranularity;
}): Promise<SnapshotBatchResult[]> => {
  const sets = input?.filterSets?.length ? input.filterSets : [defaultExecutiveSnapshotFilters()];
  const granularity = input?.granularity ?? "daily";
  const results: SnapshotBatchResult[] = [];

  for (const filters of sets) {
    const { payload, facetMs } = await buildExecutiveAnalyticsSnapshot({ filters });
    const { id, filterFingerprint } = await upsertExecutiveAnalyticsSnapshot({
      filters,
      payload,
      facetMs,
      granularity,
    });
    results.push({
      filterFingerprint,
      id,
      facetMs,
      trustIssues: payload.trustIssues.length,
    });
  }

  return results;
};
