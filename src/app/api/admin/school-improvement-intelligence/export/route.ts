import { NextRequest, NextResponse } from "next/server";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { requireSession } from "@/lib/auth-guard";
import { roleHasCapability } from "@/lib/app-role-scope-matrix";
import { buildSchoolImprovementIntelligence } from "@/lib/school-improvement/school-improvement-service";
import { buildSchoolImprovementReportHtml } from "@/lib/school-improvement/school-improvement-export";
import type { SchoolImprovementReportKind } from "@/lib/school-improvement/school-improvement-types";
import { runHardenedRoute } from "@/lib/resilience/hardened-route";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const REPORT_KINDS = new Set<SchoolImprovementReportKind>(["board", "leadership", "school_planning"]);

export async function GET(request: NextRequest) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  const role = String(gate.user.role || "");
  if (!roleHasCapability(role, "advancedAnalytics")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return runHardenedRoute(request, {
    path: "/api/admin/school-improvement-intelligence/export",
    timeoutMs: 180_000,
    handler: async () => {
      try {
        const { searchParams } = request.nextUrl;
        const report = String(searchParams.get("report") || "board").trim() as SchoolImprovementReportKind;
        const locale = searchParams.get("lang") === "en" ? "en" : "ar";
        const format = String(searchParams.get("format") || "html").trim().toLowerCase();

        if (!REPORT_KINDS.has(report)) {
          return NextResponse.json({ error: "Invalid report kind" }, { status: 400 });
        }

        const improvement = await buildSchoolImprovementIntelligence();

        if (format === "html" || format === "pdf") {
          const html = buildSchoolImprovementReportHtml(improvement, report, locale);
          const filename = `school-improvement-${report}-${new Date().toISOString().slice(0, 10)}.html`;
          return new NextResponse(html, {
            headers: {
              "Content-Type": "text/html; charset=utf-8",
              "Content-Disposition": `attachment; filename="${filename}"`,
            },
          });
        }

        return NextResponse.json({ ok: true, improvement, report });
      } catch (error) {
        console.error("[GET /api/admin/school-improvement-intelligence/export]", error);
        return jsonInternalServerError(error);
      }
    },
  });
}
