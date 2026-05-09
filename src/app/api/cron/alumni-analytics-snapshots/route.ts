import { NextRequest, NextResponse } from "next/server";
import { upsertAlumniAnalyticsSnapshot } from "@/lib/alumni/analytics/snapshot-engine";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Periodic snapshots — call with Authorization: Bearer CRON_SECRET (same pattern as other crons).
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
    const ref = new Date();
    const [daily, weekly, monthly] = await Promise.all([
      upsertAlumniAnalyticsSnapshot("daily", ref),
      upsertAlumniAnalyticsSnapshot("weekly", ref),
      upsertAlumniAnalyticsSnapshot("monthly", ref),
    ]);
    return NextResponse.json({ ok: true, daily, weekly, monthly });
  } catch (e) {
    console.error("[cron/alumni-analytics-snapshots]", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
