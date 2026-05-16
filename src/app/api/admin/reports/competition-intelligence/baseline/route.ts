import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { requireAchievementReviewer } from "@/lib/review-auth";
import { roleHasCapability } from "@/lib/app-role-scope-matrix";
import { buildCompetitionBaselineReport } from "@/lib/competition/analytics/baseline-engine";
import { getLatestCompetitionSnapshot } from "@/lib/competition/analytics/historical-metrics";
import type { CompetitionSnapshotPayload } from "@/lib/competition/analytics/snapshot-engine";
import type { CompetitionSnapshotGranularity } from "@/models/CompetitionAnalyticsSnapshot";
import { CI_AGGREGATION_VERSION } from "@/lib/competition/analytics/aggregation-version";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireAchievementReviewer();
  if (!gate.ok) return gate.response;
  if (!roleHasCapability(String(gate.user.role), "reports")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const g = (request.nextUrl.searchParams.get("granularity") || "weekly") as CompetitionSnapshotGranularity;

  try {
    await connectDB();
    const latest = await getLatestCompetitionSnapshot(g);
    const current = (latest?.payload as CompetitionSnapshotPayload | undefined) ?? null;
    const report = await buildCompetitionBaselineReport({ granularity: g, current });

    return NextResponse.json({
      ...report,
      aggregationVersion: CI_AGGREGATION_VERSION,
      snapshotTrustStatus: latest?.trustStatus ?? null,
    });
  } catch (e) {
    console.error("[GET competition-intelligence/baseline]", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
