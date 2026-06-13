import { NextRequest, NextResponse } from "next/server";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { requireSession } from "@/lib/auth-guard";
import { roleHasCapability } from "@/lib/app-role-scope-matrix";
import { buildExecutiveDecisionIntelligence } from "@/lib/analytics/executive-decision-intelligence-service";
import {
  buildExecutiveIntelligenceReportHtml,
  type ExecutiveReportKind,
} from "@/lib/analytics/executive-intelligence-export";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const REPORT_KINDS = new Set<ExecutiveReportKind>(["executive", "board", "school_improvement"]);

export async function GET(request: NextRequest) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  const role = String(gate.user.role || "");
  if (!roleHasCapability(role, "advancedAnalytics")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = request.nextUrl;
    const format = String(searchParams.get("format") || "json").trim().toLowerCase();
    const reportKind = String(searchParams.get("report") || "executive").trim() as ExecutiveReportKind;
    const locale = searchParams.get("lang") === "en" ? "en" : "ar";

    const dashboard = await buildExecutiveDecisionIntelligence();

    if (format === "html" || format === "pdf") {
      if (!REPORT_KINDS.has(reportKind)) {
        return NextResponse.json({ error: "Invalid report kind" }, { status: 400 });
      }
      const html = buildExecutiveIntelligenceReportHtml(dashboard, reportKind, locale);
      const filename = `executive-${reportKind}-${new Date().toISOString().slice(0, 10)}.html`;
      return new NextResponse(html, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    return NextResponse.json({ ok: true, dashboard });
  } catch (error) {
    console.error("[GET /api/admin/executive-intelligence]", error);
    return jsonInternalServerError(error);
  }
}
