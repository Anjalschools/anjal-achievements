import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-guard";
import { buildSchoolImprovementIntelligence } from "@/lib/school-improvement/school-improvement-service";
import { sanitizeDiagnosticsForProduction } from "@/lib/school-improvement/intelligence-diagnostics-builder";
import { finalizeIntelligenceDiagnostics } from "@/lib/school-improvement/intelligence-diagnostics-builder";
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
    path: "/api/admin/school-improvement-intelligence/diagnostics",
    timeoutMs: 180_000,
    fallback: async () => {
      const diagnostics = await finalizeIntelligenceDiagnostics({
        sections: {},
        warnings: ["route_fallback"],
        totalDurationMs: 0,
      });
      return {
        success: true,
        diagnostics: sanitizeDiagnosticsForProduction(diagnostics),
      };
    },
    handler: async () => {
      const started = Date.now();
      try {
        const { diagnostics } = await buildSchoolImprovementIntelligence();
        return NextResponse.json({
          success: true,
          diagnostics: sanitizeDiagnosticsForProduction(diagnostics),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        const stack = error instanceof Error ? error.stack : undefined;
        const diagnostics = await finalizeIntelligenceDiagnostics({
          sections: {
            diagnostics_route: {
              status: "unavailable",
              startedAt: new Date(started).toISOString(),
              completedAt: new Date().toISOString(),
              durationMs: Date.now() - started,
              service: "GET /api/admin/school-improvement-intelligence/diagnostics",
              message,
              stack: process.env.NODE_ENV === "production" ? undefined : stack,
              error: {
                message,
                stack: process.env.NODE_ENV === "production" ? undefined : stack,
                service: "GET /api/admin/school-improvement-intelligence/diagnostics",
              },
            },
          },
          warnings: [message],
          totalDurationMs: Date.now() - started,
        });
        return NextResponse.json({
          success: true,
          diagnostics: sanitizeDiagnosticsForProduction(diagnostics),
        });
      }
    },
  });
}
