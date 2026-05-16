import "server-only";
import CompetitionAnalyticsSnapshot from "@/models/CompetitionAnalyticsSnapshot";
import type {
  CompetitionSnapshotGranularity,
  CiTrustStatusSnapshot,
} from "@/models/CompetitionAnalyticsSnapshot";
import { buildParticipationAnalytics } from "@/lib/achievement-participation-analytics";
import type { ParticipationAnalyticsFilters } from "@/lib/achievement-participation-analytics";
import {
  CI_AGGREGATION_VERSION,
  buildAggregationMeta,
} from "@/lib/competition/analytics/aggregation-version";
import { boundsForGranularity } from "@/lib/competition/analytics/snapshot-bounds";
import { persistCompetitionTrendsFromGeneral } from "@/lib/competition/analytics/trend-persistence";

export const SNAPSHOT_PAYLOAD_VERSION = 1;

const defaultSnapshotFilters = (): ParticipationAnalyticsFilters => ({
  academicYear: "all",
  gender: "all",
  stage: "all",
  grade: "all",
  section: "all",
  mawhiba: "all",
  categories: [],
  levels: [],
  resultTokens: [],
  domain: "",
  organization: "",
  classification: "",
  primaryAchievementType: "all",
});

export type CompetitionSnapshotPayload = {
  version: number;
  aggregationVersion: number;
  computedAt: string;
  kpis: Record<string, unknown>;
  medals: {
    gold: number;
    silver: number;
    bronze: number;
    nominations: number;
    ranks: number;
  };
  outcomes: Array<{ key: string; count: number }>;
  participants: {
    distinctStudents: number;
    totalParticipations: number;
    mawhibaPct: number;
    internationalPct: number;
  };
  growth: {
    yearTrend: Array<{
      year: number;
      totalRows: number;
      distinctStudents: number;
      goldMedals: number;
    }>;
  };
  comparisonBaselines: {
    yearTrendAvgRecords: number;
    yearTrendAvgGold: number;
  };
  benchmarks: {
    activeProgramsCount: number;
    topProgramEn: string;
    excellenceProxyPct: number;
  };
  trustStatus: CiTrustStatusSnapshot;
  cacheMeta: { source: string; generatedAt: string; facetMs: number };
};

export const buildCompetitionSnapshotPayload = async (): Promise<CompetitionSnapshotPayload> => {
  const t0 = Date.now();
  const filters = defaultSnapshotFilters();
  const general = await buildParticipationAnalytics({ filters, page: 1, pageSize: 5 });

  const outcomeRows = general.charts.resultOutcomeCompare.map((x) => ({
    key: x.key,
    count: x.count,
  }));
  const gold = general.kpis.goldMedalCount;
  const silver =
    general.charts.resultOutcomeCompare.find((x) => x.key === "silver")?.count ?? 0;
  const bronze =
    general.charts.resultOutcomeCompare.find((x) => x.key === "bronze")?.count ?? 0;
  const nominations = general.kpis.nominationCount;
  const ranks = general.kpis.firstPlaceCount;

  const yearTrend = general.charts.yearTrend;
  const avgRecords =
    yearTrend.length > 0 ?
      yearTrend.reduce((s, y) => s + y.totalRows, 0) / yearTrend.length
    : 0;
  const avgGold =
    yearTrend.length > 0 ?
      yearTrend.reduce((s, y) => s + y.goldMedals, 0) / yearTrend.length
    : 0;

  const trustIssues: string[] = [];
  const outcomeSum = outcomeRows.reduce((s, x) => s + x.count, 0);
  if (general.kpis.totalParticipations > 0 && outcomeSum !== general.kpis.totalParticipations) {
    trustIssues.push("outcome_sum_mismatch");
  }
  const trustStatus: CiTrustStatusSnapshot =
    trustIssues.length === 0 ? "synced"
    : trustIssues.length <= 1 ? "partial"
    : "mismatch";

  const facetMs = Date.now() - t0;
  const meta = buildAggregationMeta();

  return {
    version: SNAPSHOT_PAYLOAD_VERSION,
    aggregationVersion: meta.aggregationVersion,
    computedAt: meta.computedAt,
    kpis: { ...general.kpis },
    medals: { gold, silver, bronze, nominations, ranks },
    outcomes: outcomeRows,
    participants: {
      distinctStudents: general.kpis.distinctStudents,
      totalParticipations: general.kpis.totalParticipations,
      mawhibaPct: general.kpis.mawhibaParticipationPct,
      internationalPct: general.kpis.internationalAchievementPct,
    },
    growth: { yearTrend },
    comparisonBaselines: {
      yearTrendAvgRecords: Math.round(avgRecords * 10) / 10,
      yearTrendAvgGold: Math.round(avgGold * 10) / 10,
    },
    benchmarks: {
      activeProgramsCount: general.kpis.activeProgramsCount,
      topProgramEn: general.kpis.topProgramLabelEn,
      excellenceProxyPct: general.kpis.globalAchievementPct,
    },
    trustStatus,
    cacheMeta: {
      source: "snapshot-engine",
      generatedAt: meta.computedAt,
      facetMs,
    },
  };
};

export const upsertCompetitionAnalyticsSnapshot = async (
  granularity: CompetitionSnapshotGranularity,
  refDate = new Date()
): Promise<{ id: string; trendRows: number }> => {
  const { start, end } = boundsForGranularity(granularity, refDate);
  const payload = await buildCompetitionSnapshotPayload();
  const doc = await CompetitionAnalyticsSnapshot.findOneAndUpdate(
    { granularity, periodStart: start },
    {
      $set: {
        periodEnd: end,
        payload,
        payloadVersion: SNAPSHOT_PAYLOAD_VERSION,
        aggregationVersion: CI_AGGREGATION_VERSION,
        trustStatus: payload.trustStatus,
        cacheMeta: payload.cacheMeta,
      },
    },
    { upsert: true, new: true }
  ).lean();

  const trendRows = await persistCompetitionTrendsFromGeneral(
    payload.growth.yearTrend,
    String((doc as { _id: unknown })._id)
  );

  return { id: String((doc as { _id: unknown })._id), trendRows };
};
