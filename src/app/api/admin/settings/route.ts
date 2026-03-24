import { NextRequest, NextResponse } from "next/server";
import { requireAdminUserManager } from "@/lib/admin-user-management-auth";
import { getPlatformSettings, mergePlatformSettingsPatch } from "@/lib/platform-settings-service";
import { logAuditEvent, actorFromUser } from "@/lib/audit-log-service";
import type { IUser } from "@/models/User";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;
  try {
    const settings = await getPlatformSettings();
    return NextResponse.json({ ok: true, settings });
  } catch (e) {
    console.error("[GET /api/admin/settings]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const before = await getPlatformSettings();
    await mergePlatformSettingsPatch({
      schoolYearPolicy: body.schoolYearPolicy as Record<string, unknown> | undefined,
      branding: body.branding as Record<string, unknown> | undefined,
      ai: body.ai as Record<string, unknown> | undefined,
      certificate: body.certificate as Record<string, unknown> | undefined,
      workflow: body.workflow as Record<string, unknown> | undefined,
    });
    const after = await getPlatformSettings();
    await logAuditEvent({
      actionType: "admin_settings_updated",
      entityType: "platform_settings",
      entityId: "default",
      descriptionAr: "تم تحديث إعدادات المنصة",
      before: before as unknown as Record<string, unknown>,
      after: after as unknown as Record<string, unknown>,
      actor: actorFromUser(gate.user as IUser),
      request,
    });
    return NextResponse.json({ ok: true, settings: after });
  } catch (e) {
    console.error("[PATCH /api/admin/settings]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
