import { NextResponse } from "next/server";
import { requireAchievementReviewer } from "@/lib/review-auth";
import { buildAdminDashboardPayload } from "@/lib/admin-dashboard-stats";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireAchievementReviewer();
  if (!gate.ok) return gate.response;

  try {
    const data = await buildAdminDashboardPayload();
    return NextResponse.json(data);
  } catch (e) {
    console.error("[GET /api/admin/dashboard]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
