import { NextResponse } from "next/server";
import { requireSettingsReadGate, isPlatformAdmin } from "@/lib/platform-settings-access";
import { getPlatformSettings } from "@/lib/platform-settings-service";

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

export async function GET() {
  const gate = await requireSettingsReadGate();
  if (!gate.ok) return gate.response;

  try {
    const settings = await getPlatformSettings();
    const role = String(gate.user.role || "");
    const readOnly = !isPlatformAdmin(gate.user.role);

    return NextResponse.json({
      success: true,
      data: pack(settings),
      meta: {
        readOnly,
        role,
        canEdit: !readOnly,
      },
      message: "تم تحميل الإعدادات",
      messageEn: "Settings loaded",
    });
  } catch (e) {
    console.error("[GET /api/admin/settings/get]", e);
    return NextResponse.json(
      { success: false, message: "خطأ في الخادم", messageEn: "Internal server error" },
      { status: 500 }
    );
  }
}
