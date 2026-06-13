import { NextRequest, NextResponse } from "next/server";
import { actorFromUser, logAuditEvent } from "@/lib/audit-log-service";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { createPartnerAccessToken } from "@/lib/partnerships/partner-access-service";
import { requirePartnershipsManageOrganizations } from "@/lib/partnerships/partnerships-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  const gate = await requirePartnershipsManageOrganizations();
  if (!gate.ok) return gate.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const organizationId = String(body.organizationId || "").trim();
    const expiresInDays = Number(body.expiresInDays ?? 30);

    if (!organizationId) {
      return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
    }

    const created = await createPartnerAccessToken({
      organizationId,
      createdBy: gate.user._id,
      expiresInDays: Number.isFinite(expiresInDays) ? expiresInDays : 30,
    });

    await logAuditEvent({
      actionType: "partner_access_created",
      entityType: "PartnerAccessToken",
      entityId: created.id,
      entityTitle: created.organizationName,
      descriptionAr: `رابط بوابة للمؤسسة: ${created.organizationName}`,
      actor: actorFromUser(gate.user),
      request,
      outcome: "success",
      metadata: {
        organizationId: created.organizationId,
        expiresAt: created.expiresAt,
      },
    });

    return NextResponse.json({ ok: true, item: created });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error";
    if (message.includes("Invalid") || message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("[POST /api/admin/partnerships/partner-access]", error);
    return jsonInternalServerError(error);
  }
}
