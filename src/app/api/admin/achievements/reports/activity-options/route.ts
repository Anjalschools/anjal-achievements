import { NextRequest, NextResponse } from "next/server";
import { requireAchievementReviewer } from "@/lib/review-auth";
import { roleHasCapability } from "@/lib/app-role-scope-matrix";
import { buildCanonicalActivityOptions } from "@/lib/achievement-admin-reports";
import { parseReportCsvParam } from "@/lib/report-filter-options";
import { jsonInternalServerError } from "@/lib/api-safe-response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireAchievementReviewer();
  if (!gate.ok) return gate.response;
  if (!roleHasCapability(String(gate.user.role), "reports")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  try {
    const options = await buildCanonicalActivityOptions({
      academicYear: String(searchParams.get("academicYear") || "").trim() || undefined,
      gender: String(searchParams.get("gender") || "").trim() || undefined,
      mawhiba: String(searchParams.get("mawhiba") || "").trim() || undefined,
      stage: String(searchParams.get("stage") || "").trim() || undefined,
      grade: String(searchParams.get("grade") || "").trim() || undefined,
      categories: parseReportCsvParam(searchParams.get("category")),
      levels: parseReportCsvParam(searchParams.get("level")),
      resultTokens: parseReportCsvParam(searchParams.get("result")),
      status: String(searchParams.get("status") || "").trim() || undefined,
      certificateStatus: String(searchParams.get("certificateStatus") || "").trim() || undefined,
      fromDate: String(searchParams.get("fromDate") || "").trim() || undefined,
      toDate: String(searchParams.get("toDate") || "").trim() || undefined,
      search: String(searchParams.get("q") || "").trim() || undefined,
      limit: Math.min(500, Math.max(1, Number(searchParams.get("limit") || 200) || 200)),
    });
    return NextResponse.json({ ok: true, options });
  } catch (e) {
    console.error("[GET admin achievements reports activity-options]", e);
    return jsonInternalServerError(e);
  }
}
