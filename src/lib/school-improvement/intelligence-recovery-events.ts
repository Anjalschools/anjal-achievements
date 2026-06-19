import "server-only";
import connectDB from "@/lib/mongodb";
import IntelligenceRecoveryEvent from "@/models/IntelligenceRecoveryEvent";
import type { IntelligenceServiceDomain } from "@/models/IntelligenceSectionSnapshot";
import type { IntelligenceRecoveryOutcome } from "@/models/IntelligenceRecoveryEvent";

export const recordIntelligenceRecoveryEvent = async (input: {
  domain: IntelligenceServiceDomain;
  section?: string;
  service?: string;
  outcome: IntelligenceRecoveryOutcome;
  retryCount: number;
  recoveredAfterRetry: boolean;
  snapshotFallback: boolean;
  durationMs: number;
  message?: string;
}) => {
  await connectDB();
  await IntelligenceRecoveryEvent.create(input);
};

export const loadRecoveryStats = async (sinceMs = 30 * 24 * 60 * 60 * 1000) => {
  await connectDB();
  const since = new Date(Date.now() - sinceMs);
  const events = await IntelligenceRecoveryEvent.find({ createdAt: { $gte: since } }).lean();

  const total = events.length;
  const retrySuccess = events.filter((e) => e.outcome === "retry_success").length;
  const snapshotFallback = events.filter((e) => e.outcome === "snapshot_fallback").length;
  const queryDegraded = events.filter((e) => e.outcome === "query_degraded").length;
  const environmentRecovered = events.filter((e) => e.outcome === "environment_recovered").length;
  const failed = events.filter((e) => e.outcome === "failed").length;
  const recovered = retrySuccess + snapshotFallback + queryDegraded + environmentRecovered;
  const autoHealed = retrySuccess + snapshotFallback + queryDegraded + environmentRecovered;

  const serviceStats = new Map<string, { success: number; failure: number }>();
  for (const event of events) {
    const key = String(event.service || event.section || event.domain);
    const current = serviceStats.get(key) || { success: 0, failure: 0 };
    if (event.outcome === "failed") current.failure += 1;
    else current.success += 1;
    serviceStats.set(key, current);
  }

  const ranked = [...serviceStats.entries()].map(([service, stats]) => ({
    service,
    success: stats.success,
    failure: stats.failure,
    stability: stats.success + stats.failure > 0 ? Math.round((stats.success / (stats.success + stats.failure)) * 100) : 100,
  }));

  return {
    total,
    recovered,
    autoHealed,
    failed,
    retrySuccess,
    snapshotFallback,
    queryDegraded,
    environmentRecovered,
    recoveryRatePct: total > 0 ? Math.round((recovered / total) * 100) : 100,
    mostStableServices: ranked.sort((a, b) => b.stability - a.stability).slice(0, 5),
    mostUnstableServices: ranked.sort((a, b) => a.stability - b.stability).slice(0, 5),
  };
};
