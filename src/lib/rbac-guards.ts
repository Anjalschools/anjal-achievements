import { NextResponse } from "next/server";
import type { IUser } from "@/models/User";
import {
  roleHasCapability,
  type RoleCapabilityKey,
  getRequiredCapabilityForAdminPath,
} from "@/lib/app-role-scope-matrix";
import { getCurrentDbUser } from "@/lib/auth";

export type AuthedUser = NonNullable<Awaited<ReturnType<typeof getCurrentDbUser>>>;

export type CapabilityGate =
  | { ok: true; user: AuthedUser }
  | { ok: false; response: NextResponse };

export const requireCapability = async (key: RoleCapabilityKey): Promise<CapabilityGate> => {
  const user = await getCurrentDbUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const role = String((user as IUser).role || "");
  if (!roleHasCapability(role, key)) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true, user };
};

/** Use when the route maps 1:1 to a single capability. */
export const requireCapabilityForPath = async (pathname: string): Promise<CapabilityGate> => {
  const req = getRequiredCapabilityForAdminPath(pathname);
  if (!req) {
    const user = await getCurrentDbUser();
    if (!user) {
      return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    }
    return { ok: true, user };
  }
  return requireCapability(req);
};
