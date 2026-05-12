import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { requireAlumniAdministrationActor } from "@/lib/admin-user-management-auth";
import { listAlumniSnapshots } from "@/lib/alumni/analytics/historical-metrics";
import { topIndustryTrend } from "@/lib/alumni/analytics/trend-analysis";
import type { AlumniSnapshotGranularity } from "@/models/AlumniAnalyticsSnapshot";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireAlumniAdministrationActor();
  if (!gate.ok) return gate.response;

  const g = request.nextUrl.searchParams.get("granularity") as AlumniSnapshotGranularity | null;
  if (g !== "daily" && g !== "weekly" && g !== "monthly") {
    return NextResponse.json({ error: "INVALID_GRANULARITY" }, { status: 400 });
  }
  const limit = Math.min(120, Math.max(2, Number(request.nextUrl.searchParams.get("limit")) || 24));

  try {
    await connectDB();
    const items = await listAlumniSnapshots(g, limit);
    const mapped = items.map((row: any) => ({
      periodStart: row.periodStart as Date,
      payload: row.payload as Record<string, unknown>,
    }));
    const industryTrend = topIndustryTrend(mapped);

    const sorted = [...items].sort(
      (a: any, b: any) => new Date(b.periodStart).getTime() - new Date(a.periodStart).getTime()
    );
    const latest = sorted[0]?.payload as { overview?: { cohortSizes?: { year: number; count: number }[] } } | undefined;
    const prev = sorted[1]?.payload as { overview?: { cohortSizes?: { year: number; count: number }[] } } | undefined;
    const latestCohorts = latest?.overview?.cohortSizes || [];
    const prevCohorts = prev?.overview?.cohortSizes || [];
    const prevMap = new Map(prevCohorts.map((c) => [c.year, c.count]));
    const cohortEvolution = latestCohorts.slice(0, 8).map((c) => ({
      year: c.year,
      count: c.count,
      delta: c.count - (prevMap.get(c.year) ?? c.count),
    }));

    const latestEg = (sorted[0]?.payload as { engagement?: { attendanceRatePercent?: number } })?.engagement;
    const prevEg = (sorted[1]?.payload as { engagement?: { attendanceRatePercent?: number } })?.engagement;

    return NextResponse.json({
      ok: true,
      data: {
        industryTrend,
        cohortEvolution,
        engagement: {
          latestAttendanceRate: latestEg?.attendanceRatePercent ?? null,
          previousAttendanceRate: prevEg?.attendanceRatePercent ?? null,
        },
      },
    });
  } catch (e) {
    console.error("[GET /api/admin/alumni/analytics/trends]", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
