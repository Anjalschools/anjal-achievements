import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth";

export type AdminUserManager = NonNullable<Awaited<ReturnType<typeof getCurrentDbUser>>>;

export type AdminUserManagementGate =
  | { ok: true; user: AdminUserManager }
  | { ok: false; response: NextResponse };

/** Full user CRUD: platform admin or supervisor only (not judges/teachers on review duty). */
export async function requireAdminUserManager(): Promise<AdminUserManagementGate> {
  const user = await getCurrentDbUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const role = String((user as { role?: string }).role || "");
  if (role !== "admin" && role !== "supervisor") {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true, user };
}
