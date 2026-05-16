import "server-only";
import connectDB from "@/lib/mongodb";
import CompetitionAnalyticsSnapshot from "@/models/CompetitionAnalyticsSnapshot";
import CompetitionTrendRecord from "@/models/CompetitionTrendRecord";
import { CI_AGGREGATION_VERSION } from "@/lib/competition/analytics/aggregation-version";
import { SNAPSHOT_PAYLOAD_VERSION } from "@/lib/competition/analytics/snapshot-engine";
import type { CompetitionSnapshotGranularity } from "@/models/CompetitionAnalyticsSnapshot";

export type SnapshotIntegrityRow = {
  granularity: CompetitionSnapshotGranularity;
  id: string;
  periodStart: string;
  periodEnd: string;
  payloadVersion: number;
  aggregationVersion: number;
  trustStatus: string;
  payloadBytes: number;
  cacheMeta: { source?: string; generatedAt?: string; facetMs?: number };
  hasKpis: boolean;
  hasYearTrend: boolean;
  hasBaselines: boolean;
};

export type CompetitionSnapshotIntegrityReport = {
  ok: boolean;
  checkedAt: string;
  expectedPayloadVersion: number;
  expectedAggregationVersion: number;
  snapshots: SnapshotIntegrityRow[];
  trendRecordCount: number;
  latestTrendYears: number[];
  issues: string[];
};

const payloadBytes = (payload: unknown): number => {
  try {
    return Buffer.byteLength(JSON.stringify(payload ?? {}), "utf8");
  } catch {
    return 0;
  }
};

export const verifyCompetitionSnapshotIntegrity = async (): Promise<CompetitionSnapshotIntegrityReport> => {
  await connectDB();
  const issues: string[] = [];
  const granularities: CompetitionSnapshotGranularity[] = ["daily", "weekly", "monthly"];
  const snapshots: SnapshotIntegrityRow[] = [];

  for (const granularity of granularities) {
    const doc = await CompetitionAnalyticsSnapshot.findOne({ granularity })
      .sort({ periodStart: -1 })
      .lean();
    if (!doc) {
      issues.push(`missing_snapshot_${granularity}`);
      continue;
    }
    const p = doc.payload as Record<string, unknown> | undefined;
    const row: SnapshotIntegrityRow = {
      granularity,
      id: String(doc._id),
      periodStart: new Date(doc.periodStart).toISOString(),
      periodEnd: new Date(doc.periodEnd).toISOString(),
      payloadVersion: Number(doc.payloadVersion) || 0,
      aggregationVersion: Number(doc.aggregationVersion) || 0,
      trustStatus: String(doc.trustStatus ?? "unknown"),
      payloadBytes: payloadBytes(p),
      cacheMeta: (doc.cacheMeta as SnapshotIntegrityRow["cacheMeta"]) ?? {},
      hasKpis: Boolean(p && typeof p === "object" && "kpis" in p),
      hasYearTrend: Boolean(
        p &&
          typeof p === "object" &&
          "growth" in p &&
          Array.isArray((p.growth as { yearTrend?: unknown })?.yearTrend)
      ),
      hasBaselines: Boolean(
        p && typeof p === "object" && "comparisonBaselines" in p
      ),
    };
    snapshots.push(row);
    if (row.payloadVersion !== SNAPSHOT_PAYLOAD_VERSION) {
      issues.push(`payload_version_mismatch_${granularity}`);
    }
    if (row.aggregationVersion !== CI_AGGREGATION_VERSION) {
      issues.push(`aggregation_version_mismatch_${granularity}`);
    }
    if (!row.hasKpis) issues.push(`missing_kpis_${granularity}`);
    if (!row.hasYearTrend) issues.push(`missing_year_trend_${granularity}`);
    if (!row.hasBaselines) issues.push(`missing_baselines_${granularity}`);
    if (!row.cacheMeta?.generatedAt) issues.push(`missing_cache_meta_${granularity}`);
  }

  const trendCount = await CompetitionTrendRecord.countDocuments();
  const trendYears = await CompetitionTrendRecord.find()
    .sort({ academicYear: -1 })
    .limit(8)
    .select({ academicYear: 1 })
    .lean();
  const latestTrendYears = trendYears.map((t) => t.academicYear);

  if (trendCount === 0) issues.push("no_trend_records");

  return {
    ok: issues.length === 0,
    checkedAt: new Date().toISOString(),
    expectedPayloadVersion: SNAPSHOT_PAYLOAD_VERSION,
    expectedAggregationVersion: CI_AGGREGATION_VERSION,
    snapshots,
    trendRecordCount: trendCount,
    latestTrendYears,
    issues,
  };
};
