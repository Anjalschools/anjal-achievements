import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { requireAchievementReviewer } from "@/lib/review-auth";
import { roleHasCapability } from "@/lib/app-role-scope-matrix";
import { replayHistoricalCompetitionReport } from "@/lib/competition/historical-replay";
import type { CompetitionSnapshotGranularity } from "@/models/CompetitionAnalyticsSnapshot";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireAchievementReviewer();
  if (!gate.ok) return gate.response;
  if (!roleHasCapability(String(gate.user.role), "reports")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const snapshotId = searchParams.get("snapshotId");
  const granularity = searchParams.get("granularity") as CompetitionSnapshotGranularity | null;
  const periodStartIso = searchParams.get("periodStart");

  if (!snapshotId && !(granularity && periodStartIso)) {
    return NextResponse.json(
      { error: "Provide snapshotId or granularity+periodStart" },
      { status: 400 }
    );
  }

  try {
    await connectDB();
    const result = await replayHistoricalCompetitionReport({
      snapshotId: snapshotId ?? undefined,
      granularity: granularity ?? undefined,
      periodStartIso: periodStartIso ?? undefined,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (e) {
    console.error("[GET competition-intelligence/replay]", e);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
