import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { requireAdminUserManager } from "@/lib/admin-user-management-auth";
import { listAlumniSnapshots } from "@/lib/alumni/analytics/historical-metrics";
import { snapshotsToGrowthSeries } from "@/lib/alumni/analytics/trend-analysis";
import type { AlumniSnapshotGranularity } from "@/models/AlumniAnalyticsSnapshot";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;

  const g = request.nextUrl.searchParams.get("granularity") as AlumniSnapshotGranularity | null;
  if (g !== "daily" && g !== "weekly" && g !== "monthly") {
    return NextResponse.json({ error: "INVALID_GRANULARITY" }, { status: 400 });
  }
  const limit = Math.min(120, Math.max(2, Number(request.nextUrl.searchParams.get("limit")) || 60));

  try {
    await connectDB();
    const items = await listAlumniSnapshots(g, limit);
    const series = snapshotsToGrowthSeries(
      items.map((row: any) => ({ periodStart: row.periodStart, payload: row.payload as Record<string, unknown> }))
    );
    return NextResponse.json({ ok: true, data: { series } });
  } catch (e) {
    console.error("[GET /api/admin/alumni/analytics/history]", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
