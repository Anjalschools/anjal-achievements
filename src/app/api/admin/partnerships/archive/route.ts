import { NextRequest, NextResponse } from "next/server";
import { actorFromUser, logAuditEvent } from "@/lib/audit-log-service";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { archivePartnershipAcademicYear } from "@/lib/partnerships/partnerships-archive";
import { requirePartnershipsManage } from "@/lib/partnerships/partnerships-auth";
import { getPartnershipProgramSettings } from "@/lib/partnerships/partnerships-settings-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  const gate = await requirePartnershipsManage();
  if (!gate.ok) return gate.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const academicYear = String(body.academicYear || "").trim();
    if (!academicYear) {
      return NextResponse.json({ error: "academicYear is required" }, { status: 400 });
    }

    const result = await archivePartnershipAcademicYear({
      academicYear,
      actorId: gate.user._id,
    });

    await logAuditEvent({
      actionType: "partnerships_archive_executed",
      entityType: "PartnershipProgram",
      entityId: academicYear,
      descriptionAr: `أرشفة دورة التدريب للعام ${academicYear}`,
      actor: actorFromUser(gate.user),
      request,
      outcome: "success",
      metadata: result,
    });

    const settings = await getPartnershipProgramSettings();
    return NextResponse.json({ ok: true, result, settings });
  } catch (error) {
    console.error("[POST /api/admin/partnerships/archive]", error);
    return jsonInternalServerError(error);
  }
}
