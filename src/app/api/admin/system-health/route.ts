import { NextRequest, NextResponse } from "next/server";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { requireSession } from "@/lib/auth-guard";
import { roleHasCapability } from "@/lib/app-role-scope-matrix";
import { actorFromUser, logAuditEvent } from "@/lib/audit-log-service";
import { buildPlatformCertification } from "@/lib/certification/platform-certification-service";
import { buildPlatformReadinessReportHtml } from "@/lib/certification/platform-readiness-export";
import { runHardenedRoute } from "@/lib/resilience/hardened-route";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  const role = String(gate.user.role || "");
  if (!roleHasCapability(role, "platformSettings")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return runHardenedRoute(request, {
    path: "/api/admin/system-health",
    timeoutMs: 120_000,
    handler: async () => {
      try {
        const { searchParams } = request.nextUrl;
        const format = String(searchParams.get("format") || "json").trim().toLowerCase();
        const locale = searchParams.get("lang") === "en" ? "en" : "ar";

        const certification = await buildPlatformCertification();

        const criticalIssues =
          certification.dataQuality.issueCount +
          certification.crossSystemIntegrity.issueCount +
          certification.observability.errors.length;
        const outcome =
          certification.readinessScore >= 75 && criticalIssues === 0
            ? "success"
            : certification.readinessScore >= 50
              ? "partial"
              : "failure";

        void logAuditEvent({
          actionType: "platform_certification_scan",
          entityType: "platform",
          entityId: "system-health",
          actor: actorFromUser(gate.user),
          outcome,
          metadata: {
            readinessScore: certification.readinessScore,
            readinessGrade: certification.readinessGrade,
            dataQualityIssues: certification.dataQuality.issueCount,
            integrityIssues: certification.crossSystemIntegrity.issueCount,
          },
          request,
        });

        if (format === "html" || format === "pdf") {
          const html = buildPlatformReadinessReportHtml(certification, locale);
          const filename = `platform-readiness-${new Date().toISOString().slice(0, 10)}.html`;
          return new NextResponse(html, {
            headers: {
              "Content-Type": "text/html; charset=utf-8",
              "Content-Disposition": `attachment; filename="${filename}"`,
            },
          });
        }

        return NextResponse.json({ ok: true, certification });
      } catch (error) {
        console.error("[GET /api/admin/system-health]", error);
        return jsonInternalServerError(error);
      }
    },
  });
}
