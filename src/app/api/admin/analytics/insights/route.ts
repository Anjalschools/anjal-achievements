import { NextResponse } from "next/server";
import { requireAchievementReviewer } from "@/lib/review-auth";
import { buildAdminAnalyticsInsights } from "@/lib/admin-analytics-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const gate = await requireAchievementReviewer();
  if (!gate.ok) return gate.response;
  try {
    const insights = await buildAdminAnalyticsInsights();
    return NextResponse.json({ ok: true, insights });
  } catch (e) {
    console.error("[GET /api/admin/analytics/insights]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
