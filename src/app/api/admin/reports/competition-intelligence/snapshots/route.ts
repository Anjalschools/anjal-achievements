import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { requireAchievementReviewer } from "@/lib/review-auth";
import { roleHasCapability } from "@/lib/app-role-scope-matrix";
import { listCompetitionSnapshots } from "@/lib/competition/analytics/historical-metrics";
import type { CompetitionSnapshotGranularity } from "@/models/CompetitionAnalyticsSnapshot";
import { CI_AGGREGATION_VERSION } from "@/lib/competition/analytics/aggregation-version";
import {
  DEFAULT_COMPETITION_SCALABILITY_POLICY,
  clampArray,
} from "@/lib/competition/governance/scalability-policy";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireAchievementReviewer();
  if (!gate.ok) return gate.response;
  if (!roleHasCapability(String(gate.user.role), "reports")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const g = request.nextUrl.searchParams.get("granularity") as CompetitionSnapshotGranularity | null;
  if (g !== "daily" && g !== "weekly" && g !== "monthly") {
    return NextResponse.json({ error: "INVALID_GRANULARITY" }, { status: 400 });
  }
  const limitRaw = Number(request.nextUrl.searchParams.get("limit")) || 24;
  const limit = Math.min(
    DEFAULT_COMPETITION_SCALABILITY_POLICY.maxSnapshotList,
    Math.max(2, limitRaw)
  );

  try {
    await connectDB();
    const items = await listCompetitionSnapshots(g, limit);
    const mapped = items.map((row) => ({
      id: String(row._id),
      granularity: row.granularity,
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      payloadVersion: row.payloadVersion,
      aggregationVersion: row.aggregationVersion ?? CI_AGGREGATION_VERSION,
      trustStatus: row.trustStatus,
      cacheMeta: row.cacheMeta,
      payload: row.payload,
    }));
    const clamped = clampArray(mapped, limit, "maxSnapshotList");

    return NextResponse.json({
      ok: true,
      aggregationVersion: CI_AGGREGATION_VERSION,
      items: clamped.value,
      truncated: clamped.truncated,
    });
  } catch (e) {
    console.error("[GET competition-intelligence/snapshots]", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
