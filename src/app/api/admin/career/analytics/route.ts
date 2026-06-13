import { NextResponse } from "next/server";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { requireSession } from "@/lib/auth-guard";
import { requirePermission } from "@/lib/requirePermission";
import { PERMISSIONS } from "@/constants/permissions";
import { buildCareerAnalyticsDashboard } from "@/lib/career/career-analytics-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  const allowed = await requirePermission(gate.user, PERMISSIONS.analyticsView);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const dashboard = await buildCareerAnalyticsDashboard();
    return NextResponse.json({ ok: true, dashboard });
  } catch (error) {
    console.error("[GET /api/admin/career/analytics]", error);
    return jsonInternalServerError(error);
  }
}
