import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { requireAlumniAdministrationActor } from "@/lib/admin-user-management-auth";
import { listAlumniSnapshots } from "@/lib/alumni/analytics/historical-metrics";
import type { AlumniSnapshotGranularity } from "@/models/AlumniAnalyticsSnapshot";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireAlumniAdministrationActor();
  if (!gate.ok) return gate.response;

  const g = request.nextUrl.searchParams.get("granularity") as AlumniSnapshotGranularity | null;
  if (g !== "daily" && g !== "weekly" && g !== "monthly") {
    return NextResponse.json({ error: "INVALID_GRANULARITY" }, { status: 400 });
  }
  const limit = Math.min(120, Math.max(1, Number(request.nextUrl.searchParams.get("limit")) || 60));

  try {
    await connectDB();
    const items = await listAlumniSnapshots(g, limit);
    return NextResponse.json({
      ok: true,
      data: {
        items: items.map((row: any) => ({
          id: String(row._id),
          granularity: row.granularity,
          periodStart: row.periodStart,
          periodEnd: row.periodEnd,
          payloadVersion: row.payloadVersion,
          createdAt: row.createdAt,
        })),
      },
    });
  } catch (e) {
    console.error("[GET /api/admin/alumni/analytics/snapshots]", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
