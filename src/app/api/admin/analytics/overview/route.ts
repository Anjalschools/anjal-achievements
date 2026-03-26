import { NextResponse } from "next/server";
import { requireAchievementReviewer } from "@/lib/review-auth";
import { roleHasCapability } from "@/lib/app-role-scope-matrix";
import { buildAdminAnalyticsOverview } from "@/lib/admin-analytics-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const gate = await requireAchievementReviewer();
  if (!gate.ok) return gate.response;
  if (!roleHasCapability(String(gate.user.role), "advancedAnalytics")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const overview = await buildAdminAnalyticsOverview();
    return NextResponse.json({ ok: true, overview });
  } catch (e) {
    console.error("[GET /api/admin/analytics/overview]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
