import { NextRequest, NextResponse } from "next/server";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { requireSession } from "@/lib/auth-guard";
import { roleHasCapability } from "@/lib/app-role-scope-matrix";
import { buildSchoolIntelligenceNetwork } from "@/lib/school-intelligence/school-intelligence-service";
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
    path: "/api/admin/school-intelligence",
    timeoutMs: 120_000,
    handler: async () => {
      try {
        const intelligence = await buildSchoolIntelligenceNetwork();
        return NextResponse.json({ ok: true, intelligence });
      } catch (error) {
        console.error("[GET /api/admin/school-intelligence]", error);
        return jsonInternalServerError(error);
      }
    },
  });
}
