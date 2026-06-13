import { NextRequest, NextResponse } from "next/server";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { requireSession } from "@/lib/auth-guard";
import { roleHasCapability } from "@/lib/app-role-scope-matrix";
import { buildSchoolImprovementIntelligence } from "@/lib/school-improvement/school-improvement-service";
import { runHardenedRoute } from "@/lib/resilience/hardened-route";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  const role = String(gate.user.role || "");
  if (!roleHasCapability(role, "advancedAnalytics")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return runHardenedRoute(request, {
    path: "/api/admin/school-improvement-intelligence",
    timeoutMs: 180_000,
    handler: async () => {
      try {
        const improvement = await buildSchoolImprovementIntelligence();
        return NextResponse.json({ ok: true, improvement });
      } catch (error) {
        console.error("[GET /api/admin/school-improvement-intelligence]", error);
        return jsonInternalServerError(error);
      }
    },
  });
}
