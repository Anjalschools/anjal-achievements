import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-guard";
import { buildSchoolImprovementIntelligence } from "@/lib/school-improvement/school-improvement-service";
import { sanitizeDiagnosticsForProduction } from "@/lib/school-improvement/intelligence-diagnostics-builder";
import {
  buildIntelligenceDiagnosticsExcelBuffer,
  buildIntelligenceDiagnosticsExportHtml,
} from "@/lib/school-improvement/intelligence-diagnostics-export";
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
    path: "/api/admin/school-improvement-intelligence/diagnostics/export",
    timeoutMs: 180_000,
    handler: async () => {
      const { searchParams } = request.nextUrl;
      const format = String(searchParams.get("format") || "json").trim().toLowerCase();
      const locale = searchParams.get("lang") === "en" ? "en" : "ar";
      const { diagnostics } = await buildSchoolImprovementIntelligence();
      const payload = sanitizeDiagnosticsForProduction(diagnostics);
      const stamp = new Date().toISOString().slice(0, 10);

      if (format === "json") {
        return NextResponse.json({ success: true, diagnostics: payload });
      }

      if (format === "html" || format === "pdf") {
        const html = buildIntelligenceDiagnosticsExportHtml(payload, locale);
        return new NextResponse(html, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Content-Disposition": `attachment; filename="intelligence-diagnostics-${stamp}.html"`,
          },
        });
      }

      if (format === "xlsx" || format === "excel") {
        const buffer = await buildIntelligenceDiagnosticsExcelBuffer(payload);
        return new NextResponse(new Uint8Array(buffer), {
          headers: {
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename="intelligence-diagnostics-${stamp}.xlsx"`,
          },
        });
      }

      return NextResponse.json({ success: false, error: "Invalid format" }, { status: 400 });
    },
  });
}
