import { NextRequest, NextResponse } from "next/server";
import { actorFromUser, logAuditEvent } from "@/lib/audit-log-service";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { runPartnershipIntegrityChecks } from "@/lib/partnerships/partnerships-integrity-jobs";
import { requirePartnershipsManage } from "@/lib/partnerships/partnerships-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const gate = await requirePartnershipsManage();
  if (!gate.ok) return gate.response;

  try {
    const result = await runPartnershipIntegrityChecks();
    await logAuditEvent({
      actionType: "partnerships_integrity_scan",
      entityType: "PartnershipProgram",
      entityId: "integrity",
      descriptionAr: `فحص سلامة البيانات: ${result.issueCount} مشكلة`,
      actor: actorFromUser(gate.user),
      request,
      outcome: result.issueCount === 0 ? "success" : "partial",
      metadata: { issueCount: result.issueCount },
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[GET /api/admin/partnerships/integrity]", error);
    return jsonInternalServerError(error);
  }
}
