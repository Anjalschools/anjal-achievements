import "server-only";
import connectDB, { pingMongo } from "@/lib/mongodb";
import { getMemorySnapshot, isMemoryPressureHigh } from "@/lib/resilience/memory-metrics";
import { getSlowRouteEntries } from "@/lib/resilience/slow-route-registry";
import { verifyCompetitionSnapshotIntegrity } from "@/lib/competition/ops/snapshot-integrity";
import mongoose from "mongoose";

export type SystemHealthPayload = {
  ok: boolean;
  generatedAt: string;
  db: { ok: boolean; readyState: number; latencyMs: number };
  memory: ReturnType<typeof getMemorySnapshot> & { pressure: boolean };
  slowRoutes: ReturnType<typeof getSlowRouteEntries>;
  snapshots: {
    ok: boolean;
    trendRecordCount: number;
    issues: string[];
    lastDaily?: string;
  };
  cache: { note: string };
  export: { degradedModeCapable: boolean };
  cron: { competitionConfigured: boolean; secretConfigured: boolean };
  degradedModeActive: boolean;
};

export const collectSystemHealth = async (): Promise<SystemHealthPayload> => {
  const t0 = Date.now();
  let dbOk = false;
  try {
    await connectDB();
    dbOk = await pingMongo();
  } catch {
    dbOk = false;
  }
  const dbLatencyMs = Date.now() - t0;
  const mem = getMemorySnapshot();

  let snapshotSummary = {
    ok: false,
    trendRecordCount: 0,
    issues: [] as string[],
    lastDaily: undefined as string | undefined,
  };
  try {
    if (mongoose.connection.readyState === 1) {
      const integrity = await verifyCompetitionSnapshotIntegrity();
      snapshotSummary = {
        ok: integrity.ok,
        trendRecordCount: integrity.trendRecordCount,
        issues: integrity.issues,
        lastDaily: integrity.snapshots.find((s) => s.granularity === "daily")?.periodStart,
      };
    }
  } catch {
    snapshotSummary.issues = ["snapshot_check_failed"];
  }

  const slowRoutes = getSlowRouteEntries(12);
  const degradedModeActive = slowRoutes.some((r) => r.degraded) || isMemoryPressureHigh(mem);

  return {
    ok: dbOk && !isMemoryPressureHigh(mem),
    generatedAt: new Date().toISOString(),
    db: { ok: dbOk, readyState: mongoose.connection.readyState, latencyMs: dbLatencyMs },
    memory: { ...mem, pressure: isMemoryPressureHigh(mem) },
    slowRoutes,
    snapshots: snapshotSummary,
    cache: { note: "route-memory + stale-while-revalidate on participation general" },
    export: { degradedModeCapable: true },
    cron: {
      competitionConfigured: true,
      secretConfigured: Boolean(process.env.CRON_SECRET?.trim()),
    },
    degradedModeActive,
  };
};
