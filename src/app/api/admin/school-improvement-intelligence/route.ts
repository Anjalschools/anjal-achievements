import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-guard";
import { roleHasCapability } from "@/lib/app-role-scope-matrix";
import { buildSchoolImprovementIntelligence } from "@/lib/school-improvement/school-improvement-service";
import { createEmptyImprovementPayload } from "@/lib/school-improvement/school-improvement-defaults";
import {
  finalizeIntelligenceDiagnostics,
  sanitizeDiagnosticsForProduction,
} from "@/lib/school-improvement/intelligence-diagnostics-builder";
import { runHardenedRoute } from "@/lib/resilience/hardened-route";
import type { SchoolImprovementApiResponse } from "@/lib/school-improvement/school-improvement-types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  const role = String(gate.user.role || "");
  if (!roleHasCapability(role, "advancedAnalytics")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  return runHardenedRoute(request, {
    path: "/api/admin/school-improvement-intelligence",
    timeoutMs: 180_000,
    fallback: async () => {
      console.log("[SchoolIntelligence Route Active]", {
        path: "/api/admin/school-improvement-intelligence",
        mode: "fallback",
      });
      const empty = createEmptyImprovementPayload();
      const diagnostics = await finalizeIntelligenceDiagnostics({
        sections: {
          route: {
            status: "unavailable",
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            durationMs: 0,
            service: "GET /api/admin/school-improvement-intelligence",
            message: "route_fallback",
            error: { message: "route_fallback", service: "runHardenedRoute" },
          },
        },
        warnings: ["route_fallback"],
        totalDurationMs: 0,
      });
      const response: SchoolImprovementApiResponse = {
        success: true,
        data: empty,
        improvement: empty,
        ok: true,
        diagnostics: sanitizeDiagnosticsForProduction(diagnostics),
      };
      return response;
    },
    handler: async () => {
      console.log("[SchoolIntelligence Route Active]", {
        path: "/api/admin/school-improvement-intelligence",
        mode: "handler",
      });
      const routeStarted = Date.now();
      try {
        console.info("[SchoolImprovement] route start", {
          role,
          userId: String(gate.user._id || ""),
        });

        const { payload, diagnostics } = await buildSchoolImprovementIntelligence();

        const response: SchoolImprovementApiResponse = {
          success: true,
          data: payload,
          improvement: payload,
          ok: true,
          diagnostics: sanitizeDiagnosticsForProduction(diagnostics),
        };

        if (diagnostics.slow) {
          console.warn("[SchoolImprovement] route slow", {
            totalDurationMs: diagnostics.totalDurationMs,
            warnings: diagnostics.warnings,
            slowSections: diagnostics.slowSections,
          });
        }

        return NextResponse.json(response);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        const stack = error instanceof Error ? error.stack : undefined;
        console.error("[SchoolImprovement] route failure", { message, stack });

        const empty = createEmptyImprovementPayload();
        const diagnostics = await finalizeIntelligenceDiagnostics({
          sections: {
            route: {
              status: "unavailable",
              startedAt: new Date(routeStarted).toISOString(),
              completedAt: new Date().toISOString(),
              durationMs: Date.now() - routeStarted,
              service: "GET /api/admin/school-improvement-intelligence",
              message,
              stack: process.env.NODE_ENV === "production" ? undefined : stack,
              error: {
                message,
                stack: process.env.NODE_ENV === "production" ? undefined : stack,
                service: "GET /api/admin/school-improvement-intelligence",
              },
            },
          },
          warnings: [message],
          totalDurationMs: Date.now() - routeStarted,
        });

        const response: SchoolImprovementApiResponse = {
          success: true,
          data: empty,
          improvement: empty,
          ok: true,
          diagnostics: sanitizeDiagnosticsForProduction(diagnostics),
        };
        return NextResponse.json(response);
      }
    },
  });
}
