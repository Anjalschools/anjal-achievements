import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { runExecutiveSnapshotBatch } from "@/lib/analytics/server/analytics-snapshot-orchestrator";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const JOB_KEY = "executive-analytics-snapshots";

/**
 * Precomputed executive intelligence snapshots — Render Cron Job only (Bearer CRON_SECRET).
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  const auth = request.headers.get("authorization")?.trim();
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const t0 = Date.now();
  try {
    await connectDB();
    const results = await runExecutiveSnapshotBatch({ granularity: "daily" });
    const ms = Date.now() - t0;

    console.info(`[cron/${JOB_KEY}]`, {
      snapshotCount: results.length,
      durationMs: ms,
    });

    return NextResponse.json({
      ok: true,
      job: JOB_KEY,
      snapshotCount: results.length,
      durationMs: ms,
      results,
    });
  } catch (e) {
    console.error(`[cron/${JOB_KEY}]`, e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Snapshot job failed" },
      { status: 500 }
    );
  }
}
