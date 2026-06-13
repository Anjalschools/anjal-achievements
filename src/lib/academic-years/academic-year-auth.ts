import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-guard";

const READ_ROLES = new Set(["admin", "schoolAdmin", "partnershipSupervisor"]);
const ADMIN_ROLES = new Set(["admin"]);

export const isSystemAdminRole = (role: string): boolean => ADMIN_ROLES.has(String(role || "").trim());

export const requireAcademicYearRead = async () => {
  const gate = await requireSession();
  if (!gate.ok) return gate;

  const role = String(gate.user.role || "").trim();
  if (!READ_ROLES.has(role)) {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { ok: true as const, user: gate.user, canManage: isSystemAdminRole(role) };
};

export const requireAcademicYearAdmin = async () => {
  const gate = await requireAcademicYearRead();
  if (!gate.ok) return gate;
  if (!gate.canManage) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "System admin access required" }, { status: 403 }),
    };
  }
  return gate;
};
