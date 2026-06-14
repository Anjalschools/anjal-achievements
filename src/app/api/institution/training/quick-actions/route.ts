import { NextRequest, NextResponse } from "next/server";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { executeInstitutionConversationQuickAction } from "@/lib/partnerships/institution-portal-quick-actions-service";
import { requireTrainingInstitution } from "@/lib/partnerships/partnerships-institution-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  const gate = await requireTrainingInstitution();
  if (!gate.ok) return gate.response;

  const organizationId = gate.organization?.id;
  if (!organizationId) {
    return NextResponse.json({ error: "Institution organization not linked" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action || "").trim();
    if (!action) {
      return NextResponse.json({ error: "action is required" }, { status: 400 });
    }

    const actorName = String(
      gate.user.fullNameAr || gate.user.fullName || gate.organization?.name || gate.user.email || ""
    ).trim();

    const result = await executeInstitutionConversationQuickAction({
      action: action as Parameters<typeof executeInstitutionConversationQuickAction>[0]["action"],
      applicationId: body.applicationId ? String(body.applicationId) : undefined,
      organizationId,
      institutionUserId: String(gate.user._id),
      actorName,
      locale: body.locale === "en" ? "en" : "ar",
      customTitle: body.customTitle ? String(body.customTitle) : undefined,
      customDescription: body.customDescription ? String(body.customDescription) : undefined,
      meetingUrl: body.meetingUrl ? String(body.meetingUrl) : undefined,
      scheduledAt: body.scheduledAt ? String(body.scheduledAt) : undefined,
      notes: body.notes ? String(body.notes) : undefined,
      rejectionReason: body.rejectionReason ? String(body.rejectionReason) : undefined,
      request,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error, code: result.code }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[POST /api/institution/training/quick-actions]", error);
    return jsonInternalServerError(error);
  }
}
