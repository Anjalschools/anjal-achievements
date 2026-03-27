import { NextResponse } from "next/server";
import { requireAchievementReviewer } from "@/lib/review-auth";
import { buildAdminDashboardPayload } from "@/lib/admin-dashboard-stats";
import { buildAchievementAccessFilter } from "@/lib/achievement-scope-filter";
import { jsonInternalServerError } from "@/lib/api-safe-response";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireAchievementReviewer();
  if (!gate.ok) return gate.response;

  try {
    const scope = await buildAchievementAccessFilter(gate.user);
    const data = await buildAdminDashboardPayload(scope, {
      scopedUser: scope ? gate.user : undefined,
    });
    return NextResponse.json(data);
  } catch (e) {
    console.error("[GET /api/admin/dashboard]", e);
    return jsonInternalServerError(e);
  }
}
