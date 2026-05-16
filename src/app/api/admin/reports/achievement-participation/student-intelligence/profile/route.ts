import { NextRequest, NextResponse } from "next/server";
import { requireAchievementReviewer } from "@/lib/review-auth";
import { roleHasCapability } from "@/lib/app-role-scope-matrix";
import { parseParticipationFiltersFromSearchParams } from "@/lib/achievement-participation-analytics";
import { buildStudentProfileInsight } from "@/lib/student-intelligence-analytics";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { ciRedactLine, logAggregationHealth } from "@/lib/competition-intelligence-debug";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireAchievementReviewer();
  if (!gate.ok) return gate.response;
  if (!roleHasCapability(String(gate.user.role), "reports")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const participantId = String(searchParams.get("participantId") || "").trim();
    if (!participantId) {
      return NextResponse.json({ error: "participantId required" }, { status: 400 });
    }
    const filters = parseParticipationFiltersFromSearchParams(searchParams);
    const t0 = Date.now();
    const payload = await buildStudentProfileInsight(filters, participantId);
    const ms = Date.now() - t0;
    logAggregationHealth({
      facet: "student_intel_profile",
      durationMs: ms,
      filterSummary: ciRedactLine(
        JSON.stringify({
          ay: filters.academicYear,
          st: filters.stage,
          pid: participantId.slice(0, 10),
        })
      ),
      resultSize: payload.timeline.length,
      cacheStatus: "none",
    });
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "private, max-age=15" },
    });
  } catch (e) {
    console.error("[GET /api/.../student-intelligence/profile]", e);
    return jsonInternalServerError(e);
  }
}
