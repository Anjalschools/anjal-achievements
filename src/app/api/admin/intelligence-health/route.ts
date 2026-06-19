import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-guard";
import { loadIntelligenceHealthDashboard } from "@/lib/school-improvement/intelligence-health-monitor";
import { runHardenedRoute } from "@/lib/resilience/hardened-route";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const isSystemAdmin = (role: string) => String(role || "").trim() === "admin";

export async function GET(request: NextRequest) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  const role = String(gate.user.role || "");
  if (!isSystemAdmin(role)) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  return runHardenedRoute(request, {
    path: "/api/admin/intelligence-health",
    timeoutMs: 60_000,
    handler: async () => {
      const monitoring = await loadIntelligenceHealthDashboard();
      return NextResponse.json({
        success: true,
        monitoring,
      });
    },
  });
}
