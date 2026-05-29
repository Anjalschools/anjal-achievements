import "server-only";

import type { ParticipationAnalyticsFilters } from "@/lib/achievement-participation-analytics";
import type { ExecutiveFilterSnapshot } from "@/lib/competition-intelligence-persistence";
import {
  buildExecutiveAnalyticsSnapshot,
  filtersFromExecutiveSnapshot,
} from "@/lib/analytics/server/analytics-snapshot-engine";
import {
  getExecutiveSnapshotByFingerprint,
  upsertExecutiveAnalyticsSnapshot,
  resolveFingerprintForFilters,
} from "@/lib/analytics/server/analytics-snapshot-store";
import type {
  ExecutiveAnalyticsSnapshotPayload,
  ExecutiveSnapshotResolveMeta,
} from "@/lib/analytics/server/analytics-snapshot-schema";
import { fingerprintFromExecutiveFilter } from "@/lib/analytics/server/analytics-snapshot-fingerprint-server";

export const DEFAULT_SNAPSHOT_MAX_AGE_MS = 60 * 60_000;

export type ResolveExecutiveSnapshotResult = {
  bundle: ExecutiveAnalyticsSnapshotPayload;
  meta: ExecutiveSnapshotResolveMeta;
};

export const resolveExecutiveAnalyticsSnapshot = async (input: {
  filters?: ParticipationAnalyticsFilters;
  executiveFilter?: ExecutiveFilterSnapshot;
  maxAgeMs?: number;
  allowStale?: boolean;
  persist?: boolean;
  bypassSnapshot?: boolean;
}): Promise<ResolveExecutiveSnapshotResult> => {
  const filters =
    input.filters ??
    (input.executiveFilter ? filtersFromExecutiveSnapshot(input.executiveFilter) : undefined);
  if (!filters) {
    throw new Error("resolveExecutiveAnalyticsSnapshot requires filters or executiveFilter");
  }

  const filterFingerprint =
    input.executiveFilter ?
      fingerprintFromExecutiveFilter(input.executiveFilter)
    : resolveFingerprintForFilters(filters);

  const maxAge = input.maxAgeMs ?? DEFAULT_SNAPSHOT_MAX_AGE_MS;

  if (!input.bypassSnapshot) {
    const fresh = await getExecutiveSnapshotByFingerprint(filterFingerprint, {
      maxAgeMs: maxAge,
    });
    if (fresh) {
      return {
        bundle: fresh.payload,
        meta: {
          source: "snapshot",
          filterFingerprint,
          snapshotId: fresh.id,
          ageMs: fresh.ageMs,
          facetMs: 0,
          trustStatus: fresh.trustStatus,
        },
      };
    }

    if (input.allowStale) {
      const stale = await getExecutiveSnapshotByFingerprint(filterFingerprint);
      if (stale) {
        return {
          bundle: stale.payload,
          meta: {
            source: "snapshot_stale",
            filterFingerprint,
            snapshotId: stale.id,
            ageMs: stale.ageMs,
            facetMs: 0,
            trustStatus: stale.trustStatus,
          },
        };
      }
    }
  }

  const built = await buildExecutiveAnalyticsSnapshot({
    filters,
    executiveFilter: input.executiveFilter,
  });
  const bundle = built.payload;

  if (input.persist !== false) {
    await upsertExecutiveAnalyticsSnapshot({ filters, payload: bundle, facetMs: built.facetMs });
  }

  return {
    bundle,
    meta: {
      source: "live",
      filterFingerprint,
      ageMs: 0,
      facetMs: built.facetMs,
      trustStatus: bundle.trustIssues.length === 0 ? "synced" : "partial",
    },
  };
};
