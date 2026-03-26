import { NextResponse } from "next/server";
import { requireAdminUserManager } from "@/lib/admin-user-management-auth";

export const isPlatformAdmin = (role: string | undefined): boolean => String(role || "") === "admin";

/** Admin or supervisor — read settings, school years, etc. */
export const requireSettingsReadGate = () => requireAdminUserManager();

/** Writes (PATCH/update/reset): admin only. */
export async function requireSettingsWriteGate() {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate;
  if (!isPlatformAdmin(gate.user.role)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          success: false,
          message: "تعديل الإعدادات متاح لمسؤول النظام (admin) فقط",
          messageEn: "Only the system admin role may change platform settings.",
        },
        { status: 403 }
      ),
    };
  }
  return gate;
}
