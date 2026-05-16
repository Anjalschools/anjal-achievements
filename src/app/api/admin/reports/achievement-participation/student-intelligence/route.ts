import { NextRequest, NextResponse } from "next/server";
import { requireAchievementReviewer } from "@/lib/review-auth";
import { roleHasCapability } from "@/lib/app-role-scope-matrix";
import { parseParticipationFiltersFromSearchParams } from "@/lib/achievement-participation-analytics";
import { buildStudentIntelligence } from "@/lib/student-intelligence-analytics";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { ciRedactLine, logAggregationHealth, type CiObservabilityMeta } from "@/lib/competition-intelligence-debug";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireAchievementReviewer();
  if (!gate.ok) return gate.response;
  if (!roleHasCapability(String(gate.user.role), "reports")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const filters = parseParticipationFiltersFromSearchParams(searchParams);
    const t0 = Date.now();
    const payload = await buildStudentIntelligence(filters);
    const ms = Date.now() - t0;
    logAggregationHealth({
      facet: "student_intelligence",
      durationMs: ms,
      filterSummary: ciRedactLine(JSON.stringify(filters)),
      resultSize:
        payload.byParticipation.length +
        payload.byMedals.length +
        payload.byFastestGrowth.length,
      cacheStatus: "none",
    });
    const ciObservability: CiObservabilityMeta = {
      generatedAt: new Date().toISOString(),
      serverFacetMs: ms,
      cacheHit: false,
      cacheAgeMs: 0,
      source: "none",
      recomputeReason: "cold",
    };
    return NextResponse.json(
      { ...payload, ciObservability },
      {
        headers: { "Cache-Control": "private, max-age=20" },
      }
    );
  } catch (e) {
    console.error("[GET /api/admin/reports/achievement-participation/student-intelligence]", e);
    return jsonInternalServerError(e);
  }
}
