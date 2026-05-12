import { NextRequest, NextResponse } from "next/server";
import { requireAlumniAdministrationActor } from "@/lib/admin-user-management-auth";
import { actorFromUser, logAuditEvent } from "@/lib/audit-log-service";
import type { IUser } from "@/models/User";

export const dynamic = "force-dynamic";

type Body = {
  format?: "excel" | "pdf";
  scope?: "filtered" | "all";
  rowCount?: number;
  reportKind?: string;
  /** Optional: alumni PDF layout mode (presentation only). */
  pdfMode?: string;
};

export async function POST(request: NextRequest) {
  const gate = await requireAlumniAdministrationActor();
  if (!gate.ok) return gate.response;

  try {
    const body = (await request.json().catch(() => ({}))) as Body;
    const format = body.format === "pdf" ? "pdf" : "excel";
    const scope = body.scope === "all" ? "all" : "filtered";
    const rowCount = Math.min(50_000, Math.max(0, Number(body.rowCount) || 0));
    const reportKind = String(body.reportKind || "overview").slice(0, 40);
    const pdfMode = body.pdfMode ? String(body.pdfMode).slice(0, 32) : undefined;

    await logAuditEvent({
      actionType: "alumni.reports_export",
      entityType: "alumni_reports",
      descriptionAr: `تصدير تقرير خريجين (${format}) — ${scope === "all" ? "كل النتائج" : "حسب الفلاتر"}`,
      metadata: { format, scope, rowCount, reportKind, ...(pdfMode ? { pdfMode } : {}) },
      actor: actorFromUser(gate.user as unknown as IUser),
      request,
      outcome: "success",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[POST /api/admin/alumni/reports/export-audit]", error);
    return NextResponse.json({ ok: false, error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
