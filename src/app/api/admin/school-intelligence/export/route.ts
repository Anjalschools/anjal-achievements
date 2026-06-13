import { NextRequest, NextResponse } from "next/server";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { requireSession } from "@/lib/auth-guard";
import { roleHasCapability } from "@/lib/app-role-scope-matrix";
import { buildSchoolIntelligenceNetwork } from "@/lib/school-intelligence/school-intelligence-service";
import { buildSchoolIntelligenceReportHtml } from "@/lib/school-intelligence/school-intelligence-export";
import type { SchoolIntelligenceReportKind } from "@/lib/school-intelligence/school-intelligence-types";
import { runHardenedRoute } from "@/lib/resilience/hardened-route";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const REPORT_KINDS = new Set<SchoolIntelligenceReportKind>(["school", "board", "strategic_planning"]);

export async function GET(request: NextRequest) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  const role = String(gate.user.role || "");
  if (!roleHasCapability(role, "advancedAnalytics")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return runHardenedRoute(request, {
    path: "/api/admin/school-intelligence/export",
    timeoutMs: 120_000,
    handler: async () => {
      try {
        const { searchParams } = request.nextUrl;
        const report = String(searchParams.get("report") || "school").trim() as SchoolIntelligenceReportKind;
        const locale = searchParams.get("lang") === "en" ? "en" : "ar";
        const format = String(searchParams.get("format") || "html").trim().toLowerCase();

        if (!REPORT_KINDS.has(report)) {
          return NextResponse.json({ error: "Invalid report kind" }, { status: 400 });
        }

        const intelligence = await buildSchoolIntelligenceNetwork();

        if (format === "html" || format === "pdf") {
          const html = buildSchoolIntelligenceReportHtml(intelligence, report, locale);
          const filename = `school-intelligence-${report}-${new Date().toISOString().slice(0, 10)}.html`;
          return new NextResponse(html, {
            headers: {
              "Content-Type": "text/html; charset=utf-8",
              "Content-Disposition": `attachment; filename="${filename}"`,
            },
          });
        }

        return NextResponse.json({ ok: true, intelligence, report });
      } catch (error) {
        console.error("[GET /api/admin/school-intelligence/export]", error);
        return jsonInternalServerError(error);
      }
    },
  });
}
