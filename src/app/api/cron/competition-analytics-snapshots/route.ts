import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import {
  upsertCompetitionAnalyticsSnapshot,
} from "@/lib/competition/analytics/snapshot-engine";
import { rebuildCompetitionTrendHistory } from "@/lib/competition/analytics/trend-persistence";
import { verifyCompetitionSnapshotIntegrity } from "@/lib/competition/ops/snapshot-integrity";
import { logSnapshotGenerationIntel } from "@/lib/competition-intelligence-debug";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Periodic competition intelligence snapshots.
 * Production scheduler: Render Cron Job only (not Vercel Cron).
 * Authorization: Bearer CRON_SECRET
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  const auth = request.headers.get("authorization") || "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    const ref = new Date();
    const t0 = Date.now();
    const [daily, weekly, monthly] = await Promise.all([
      upsertCompetitionAnalyticsSnapshot("daily", ref),
      upsertCompetitionAnalyticsSnapshot("weekly", ref),
      upsertCompetitionAnalyticsSnapshot("monthly", ref),
    ]);
    const trendRows = await rebuildCompetitionTrendHistory(monthly.id);
    const ms = Date.now() - t0;
    const integrity = await verifyCompetitionSnapshotIntegrity();
    const payloadBytesTotal = integrity.snapshots.reduce((s, r) => s + r.payloadBytes, 0);

    logSnapshotGenerationIntel({
      granularity: "all",
      durationMs: ms,
      trendRows,
      trustStatus: integrity.ok ? "cron_ok" : "cron_integrity_warn",
    });

    // Operational line for production logs (no PII)
    console.info("[cron/competition-analytics-snapshots]", {
      ok: integrity.ok,
      durationMs: ms,
      trendRows,
      snapshotCount: integrity.snapshots.length,
      trendRecordCount: integrity.trendRecordCount,
      payloadBytesTotal,
      issues: integrity.issues.length ? integrity.issues : undefined,
    });

    return NextResponse.json({
      ok: integrity.ok,
      daily,
      weekly,
      monthly,
      trendRows,
      durationMs: ms,
      integrity,
      observability: {
        snapshotGenerationMs: ms,
        payloadBytesTotal,
        trendRecordCount: integrity.trendRecordCount,
      },
    });
  } catch (e) {
    console.error("[cron/competition-analytics-snapshots]", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
