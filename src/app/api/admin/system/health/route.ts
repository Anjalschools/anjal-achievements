import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guard";
import { collectSystemHealth } from "@/lib/resilience/health-collector";
import { runHardenedRoute } from "@/lib/resilience/hardened-route";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;

  return runHardenedRoute(request, {
    path: "/api/admin/system/health",
    timeoutMs: 15_000,
    handler: async () => {
      const data = await collectSystemHealth();
      return NextResponse.json({ ok: true, data });
    },
  });
}
