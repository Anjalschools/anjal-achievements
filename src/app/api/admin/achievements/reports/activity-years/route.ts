import { NextRequest, NextResponse } from "next/server";
import { requireAchievementReviewer } from "@/lib/review-auth";
import { roleHasCapability } from "@/lib/app-role-scope-matrix";
import { buildCanonicalActivityYearOptions } from "@/lib/achievement-admin-reports";
import { parseAdminReportFiltersFromSearchParams } from "@/lib/analytics/report-filter-params";
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
    const base = parseAdminReportFiltersFromSearchParams(searchParams);
    const options = await buildCanonicalActivityYearOptions({
      ...base,
      search: String(searchParams.get("q") || "").trim() || undefined,
      limit: Math.min(50, Math.max(1, Number(searchParams.get("limit") || 30) || 30)),
    });
    return NextResponse.json({ ok: true, options });
  } catch (e) {
    console.error("[GET admin achievements reports activity-years]", e);
    return jsonInternalServerError(e);
  }
}
