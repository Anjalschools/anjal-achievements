import { NextResponse } from "next/server";
import { requireAchievementReviewer } from "@/lib/review-auth";
import { roleHasCapability } from "@/lib/app-role-scope-matrix";
import { buildAdminAnalyticsInsights } from "@/lib/admin-analytics-service";
import { jsonInternalServerError } from "@/lib/api-safe-response";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const gate = await requireAchievementReviewer();
  if (!gate.ok) return gate.response;
  if (!roleHasCapability(String(gate.user.role), "advancedAnalytics")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const insights = await buildAdminAnalyticsInsights();
    return NextResponse.json({ ok: true, insights });
  } catch (e) {
    console.error("[GET /api/admin/analytics/insights]", e);
    return jsonInternalServerError(e);
  }
}
