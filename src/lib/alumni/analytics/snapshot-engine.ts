import AlumniAnalyticsSnapshot from "@/models/AlumniAnalyticsSnapshot";
import type { AlumniSnapshotGranularity } from "@/models/AlumniAnalyticsSnapshot";
import { getAdminAlumniUniversitiesIntel, getAdminAlumniCareersIntel } from "@/lib/alumni/admin-alumni-analytics";
import { getExecutiveAlumniDashboard } from "@/lib/alumni/executive-alumni-dashboard";
import { getAlumniReputationHistogram, getAlumniNetworkSnapshotMetrics } from "@/lib/alumni/analytics/snapshot-extra-metrics";
import { getAlumniNetworkIntelligenceV1 } from "@/lib/alumni/analytics/network-intelligence-metrics";

export const SNAPSHOT_PAYLOAD_VERSION = 2;

export const utcDayBounds = (d: Date) => {
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
};

export const utcWeekBounds = (d: Date) => {
  const day = d.getUTCDay();
  const diff = (day + 6) % 7;
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diff));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return { start, end };
};

export const utcMonthBounds = (d: Date) => {
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  return { start, end };
};

export const boundsForGranularity = (g: AlumniSnapshotGranularity, ref: Date) => {
  if (g === "daily") return utcDayBounds(ref);
  if (g === "weekly") return utcWeekBounds(ref);
  return utcMonthBounds(ref);
};

/**
 * Persisted analytics blob (daily / weekly / monthly). Version 2 adds KPIs, health, reputation histogram, and network metrics.
 */
export const buildSnapshotPayload = async (): Promise<Record<string, unknown>> => {
  const [executive, universities, careers, reputationHistogram, networkMetrics, networkIntelligence] =
    await Promise.all([
      getExecutiveAlumniDashboard(),
      getAdminAlumniUniversitiesIntel(),
      getAdminAlumniCareersIntel(),
      getAlumniReputationHistogram(),
      getAlumniNetworkSnapshotMetrics(),
      getAlumniNetworkIntelligenceV1(),
    ]);

  return {
    version: SNAPSHOT_PAYLOAD_VERSION,
    computedAt: new Date().toISOString(),
    overview: executive.overview,
    engagement: executive.engagement,
    universitiesTop: universities.items.slice(0, 12),
    careers,
    kpis: {
      verificationRatePercent: executive.verificationRatePercent,
      avgReputation: executive.avgReputation,
      profileCompletionRatePercent: executive.profileCompletionRatePercent,
      registration: executive.registration,
      topCountries: executive.topCountries,
    },
    communityHealth: executive.communityHealth,
    reputationHistogram,
    networkMetrics,
    networkIntelligence,
  };
};

export const upsertAlumniAnalyticsSnapshot = async (
  granularity: AlumniSnapshotGranularity,
  refDate = new Date()
): Promise<{ id: string }> => {
  const { start, end } = boundsForGranularity(granularity, refDate);
  const payload = await buildSnapshotPayload();
  const doc = await AlumniAnalyticsSnapshot.findOneAndUpdate(
    { granularity, periodStart: start },
    {
      $set: {
        periodEnd: end,
        payload,
        payloadVersion: SNAPSHOT_PAYLOAD_VERSION,
      },
    },
    { upsert: true, new: true }
  ).lean();
  return { id: String((doc as { _id: unknown })._id) };
};
