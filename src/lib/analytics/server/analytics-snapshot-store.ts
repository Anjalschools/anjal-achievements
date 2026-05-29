import "server-only";

import connectDB from "@/lib/mongodb";
import ExecutiveAnalyticsSnapshot, {
  type ExecutiveSnapshotGranularity,
  type ExecutiveSnapshotTrustStatus,
} from "@/models/ExecutiveAnalyticsSnapshot";
import type { ParticipationAnalyticsFilters } from "@/lib/achievement-participation-analytics";
import { CI_AGGREGATION_VERSION } from "@/lib/competition/analytics/aggregation-version";
import type { ExecutiveAnalyticsSnapshotPayload } from "@/lib/analytics/server/analytics-snapshot-schema";
import { boundsForExecutiveGranularity } from "@/lib/analytics/server/analytics-snapshot-bounds";
import { fingerprintFromParticipationFilters } from "@/lib/analytics/server/analytics-snapshot-fingerprint";

export type StoredExecutiveSnapshot = {
  id: string;
  filterFingerprint: string;
  payload: ExecutiveAnalyticsSnapshotPayload;
  trustStatus: ExecutiveSnapshotTrustStatus;
  generatedAt: string;
  ageMs: number;
};

export const upsertExecutiveAnalyticsSnapshot = async (input: {
  facetMs?: number;
  filters: ParticipationAnalyticsFilters;
  payload: ExecutiveAnalyticsSnapshotPayload;
  granularity?: ExecutiveSnapshotGranularity;
  refDate?: Date;
}): Promise<{ id: string; filterFingerprint: string }> => {
  await connectDB();
  const granularity = input.granularity ?? "on_demand";
  const ref = input.refDate ?? new Date();
  const { start, end } = boundsForExecutiveGranularity(
    granularity === "on_demand" ? "daily" : granularity,
    ref
  );
  const filterFingerprint = input.payload.filterFingerprint;
  const trustStatus: ExecutiveSnapshotTrustStatus =
    input.payload.trustIssues.length === 0 ? "synced" : "partial";

  const facetMs = input.facetMs ?? 0;

  const doc = await ExecutiveAnalyticsSnapshot.findOneAndUpdate(
    { filterFingerprint, granularity, periodStart: start },
    {
      filterFingerprint,
      granularity,
      periodStart: start,
      periodEnd: end,
      filters: input.filters,
      payload: input.payload,
      payloadVersion: input.payload.version,
      aggregationVersion: CI_AGGREGATION_VERSION,
      trustStatus,
      cacheMeta: {
        source: "analytics-snapshot-engine",
        generatedAt: input.payload.computedAt,
        facetMs,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  return { id: String(doc?._id ?? ""), filterFingerprint };
};

export const getExecutiveSnapshotByFingerprint = async (
  filterFingerprint: string,
  opts?: { granularity?: ExecutiveSnapshotGranularity; maxAgeMs?: number }
): Promise<StoredExecutiveSnapshot | null> => {
  await connectDB();
  const granularity = opts?.granularity ?? "on_demand";
  const doc = await ExecutiveAnalyticsSnapshot.findOne({ filterFingerprint, granularity })
    .sort({ periodStart: -1 })
    .lean();
  if (!doc?.payload) return null;

  const generatedAt =
    (doc.cacheMeta as { generatedAt?: string })?.generatedAt ??
    (doc.payload as ExecutiveAnalyticsSnapshotPayload).computedAt;
  const ageMs = Date.now() - new Date(generatedAt).getTime();
  if (opts?.maxAgeMs !== undefined && ageMs > opts.maxAgeMs) return null;

  return {
    id: String(doc._id),
    filterFingerprint: doc.filterFingerprint,
    payload: doc.payload as ExecutiveAnalyticsSnapshotPayload,
    trustStatus: doc.trustStatus as ExecutiveSnapshotTrustStatus,
    generatedAt,
    ageMs,
  };
};

export const listRecentExecutiveSnapshots = async (limit = 20) => {
  await connectDB();
  const rows = await ExecutiveAnalyticsSnapshot.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .select({ filterFingerprint: 1, granularity: 1, trustStatus: 1, cacheMeta: 1, createdAt: 1 })
    .lean();
  return rows.map((r) => ({
    id: String(r._id),
    filterFingerprint: r.filterFingerprint,
    granularity: r.granularity,
    trustStatus: r.trustStatus,
    generatedAt: (r.cacheMeta as { generatedAt?: string })?.generatedAt ?? null,
    createdAt: r.createdAt,
  }));
};

export const resolveFingerprintForFilters = (filters: ParticipationAnalyticsFilters): string =>
  fingerprintFromParticipationFilters(filters);
