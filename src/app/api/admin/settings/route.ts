import { NextRequest, NextResponse } from "next/server";
import { requireSettingsReadGate, requireSettingsWriteGate } from "@/lib/platform-settings-access";
import { getPlatformSettings, mergePlatformSettingsPatch } from "@/lib/platform-settings-service";
import { sanitizeBrandingPatch, validatePlatformSettingsPatch } from "@/lib/platform-settings-validation";
import { logAuditEvent, actorFromUser } from "@/lib/audit-log-service";
import type { IUser } from "@/models/User";
import { jsonInternalServerError } from "@/lib/api-safe-response";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** @deprecated Prefer GET /api/admin/settings/get — kept for backward compatibility */
export async function GET() {
  const gate = await requireSettingsReadGate();
  if (!gate.ok) return gate.response;
  try {
    const settings = await getPlatformSettings();
    return NextResponse.json({ ok: true, settings });
  } catch (e) {
    console.error("[GET /api/admin/settings]", e);
    return jsonInternalServerError(e);
  }
}

/** @deprecated Prefer POST /api/admin/settings/update — admin-only writes; supervisors read-only */
export async function PATCH(request: NextRequest) {
  const gate = await requireSettingsWriteGate();
  if (!gate.ok) return gate.response;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const before = await getPlatformSettings();
    const patch = {
      schoolYearPolicy: body.schoolYearPolicy as Record<string, unknown> | undefined,
      branding: sanitizeBrandingPatch(body.branding as Record<string, unknown> | undefined),
      ai: body.ai as Record<string, unknown> | undefined,
      certificate: body.certificate as Record<string, unknown> | undefined,
      workflow: body.workflow as Record<string, unknown> | undefined,
    };
    const v = validatePlatformSettingsPatch(
      {
        branding: before.branding as Record<string, unknown>,
        certificate: before.certificate as Record<string, unknown>,
      },
      patch
    );
    if (!v.ok) {
      return NextResponse.json({ error: v.messageAr, errorEn: v.messageEn }, { status: 400 });
    }
    await mergePlatformSettingsPatch(patch);
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
    return jsonInternalServerError(e);
  }
}
