import { NextRequest, NextResponse } from "next/server";
import { requireSettingsReadGate, requireSettingsWriteGate } from "@/lib/platform-settings-access";
import { getPlatformSettings, mergePlatformSettingsPatch } from "@/lib/platform-settings-service";
import { ALL_PERMISSIONS, PERMISSION_LABELS, type PermissionKey } from "@/constants/permissions";
import { ROLE_DEFAULT_PERMISSIONS, getRolePermissions } from "@/lib/role-permissions";
import type { AppRole } from "@/lib/app-role-scope-matrix";
import { actorFromUser, logAuditEvent } from "@/lib/audit-log-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ROLES = Object.keys(ROLE_DEFAULT_PERMISSIONS) as AppRole[];

const buildMatrix = (overrides: Partial<Record<AppRole, PermissionKey[]>>) => {
  const matrix: Record<string, PermissionKey[]> = {};
  for (const role of ROLES) {
    matrix[role] = getRolePermissions(role, overrides);
  }
  return matrix;
};

export async function GET() {
  const gate = await requireSettingsReadGate();
  if (!gate.ok) return gate.response;
  try {
    const settings = await getPlatformSettings();
    const overrides = (settings.rolePermissions || {}) as Partial<Record<AppRole, PermissionKey[]>>;
    return NextResponse.json({
      ok: true,
      roles: ROLES,
      permissions: ALL_PERMISSIONS,
      permissionLabels: PERMISSION_LABELS,
      defaults: ROLE_DEFAULT_PERMISSIONS,
      overrides,
      matrix: buildMatrix(overrides),
    });
  } catch (e) {
    console.error("[GET /api/admin/permissions]", e);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const gate = await requireSettingsWriteGate();
  if (!gate.ok) return gate.response;
  try {
    const body = (await request.json()) as { role?: string; permissions?: string[] };
    const role = String(body.role || "") as AppRole;
    if (!ROLES.includes(role)) {
      return NextResponse.json({ ok: false, error: "Invalid role" }, { status: 400 });
    }
    const next = Array.isArray(body.permissions) ? body.permissions.filter((p): p is PermissionKey => ALL_PERMISSIONS.includes(p as PermissionKey)) : [];
    await mergePlatformSettingsPatch({ rolePermissions: { [role]: next } });
    const settings = await getPlatformSettings();
    const overrides = (settings.rolePermissions || {}) as Partial<Record<AppRole, PermissionKey[]>>;

    await logAuditEvent({
      actionType: "rbac_role_permissions_updated",
      entityType: "platform_permissions",
      entityId: role,
      descriptionAr: `تم تحديث صلاحيات الدور ${role}`,
      actor: actorFromUser(gate.user as any),
      request,
      metadata: { role, permissions: next },
      outcome: "success",
      platform: "website",
    });

    return NextResponse.json({ ok: true, role, permissions: next, matrix: buildMatrix(overrides) });
  } catch (e) {
    console.error("[PATCH /api/admin/permissions]", e);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

