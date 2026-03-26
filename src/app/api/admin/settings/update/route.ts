import { NextRequest, NextResponse } from "next/server";
import { requireSettingsWriteGate } from "@/lib/platform-settings-access";
import {
  getPlatformSettings,
  mergePlatformSettingsPatch,
  resetPlatformSettingsToDefaults,
} from "@/lib/platform-settings-service";
import { sanitizeBrandingPatch, validatePlatformSettingsPatch } from "@/lib/platform-settings-validation";
import { logAuditEvent, actorFromUser } from "@/lib/audit-log-service";
import type { IUser } from "@/models/User";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const pack = (s: Awaited<ReturnType<typeof getPlatformSettings>>) => ({
  schoolYearPolicy: s.schoolYearPolicy,
  branding: s.branding,
  ai: s.ai,
  certificate: s.certificate,
  workflow: s.workflow,
  updatedAt: s.updatedAt instanceof Date ? s.updatedAt.toISOString() : null,
});

export async function POST(request: NextRequest) {
  const gate = await requireSettingsWriteGate();
  if (!gate.ok) return gate.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const resetToDefaults = body.resetToDefaults === true;

    const before = await getPlatformSettings();

    if (resetToDefaults) {
      await resetPlatformSettingsToDefaults();
      const after = await getPlatformSettings();
      await logAuditEvent({
        actionType: "admin_settings_updated",
        entityType: "platform_settings",
        entityId: "default",
        descriptionAr: "إعادة إعدادات المنصة إلى الافتراضي",
        metadata: { resetToDefaults: true },
        actor: actorFromUser(gate.user as IUser),
        request,
      });
      return NextResponse.json({
        success: true,
        data: pack(after),
        message: "تمت استعادة الإعدادات الافتراضية",
        messageEn: "Settings reset to defaults",
      });
    }

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
      return NextResponse.json(
        {
          success: false,
          message: v.messageAr,
          messageEn: v.messageEn,
        },
        { status: 400 }
      );
    }

    await mergePlatformSettingsPatch({
      schoolYearPolicy: patch.schoolYearPolicy,
      branding: patch.branding,
      ai: patch.ai,
      certificate: patch.certificate,
      workflow: patch.workflow,
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

    return NextResponse.json({
      success: true,
      data: pack(after),
      message: "تم التحديث بنجاح",
      messageEn: "Updated successfully",
    });
  } catch (e) {
    console.error("[POST /api/admin/settings/update]", e);
    return NextResponse.json(
      { success: false, message: "فشل الحفظ", messageEn: "Save failed" },
      { status: 500 }
    );
  }
}
