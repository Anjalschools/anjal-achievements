import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth";
import { warnSecurityEvent } from "@/lib/security-log";

/**
 * Session guard for App Router API routes.
 * This project uses httpOnly cookie sessions (see {@link getCurrentDbUser}), not NextAuth JWT.
 * `request` is accepted for API stability and forward-compatibility.
 */
export type AuthedUser = NonNullable<Awaited<ReturnType<typeof getCurrentDbUser>>>;

export type AuthGuardResult =
  | { ok: true; user: AuthedUser }
  | { ok: false; response: NextResponse };

const unauthorized = () =>
  NextResponse.json({ error: "Unauthorized" }, { status: 401 });

const forbidden = () => NextResponse.json({ error: "Forbidden" }, { status: 403 });

export const requireSession = async (_request?: NextRequest): Promise<AuthGuardResult> => {
  const user = await getCurrentDbUser();
  if (!user) {
    warnSecurityEvent("access_denied", { reason: "no_session" });
    return { ok: false, response: unauthorized() };
  }
  return { ok: true, user };
};

export const requireRole = async (
  _request: NextRequest | undefined,
  roles: string[]
): Promise<AuthGuardResult> => {
  const gate = await requireSession(_request);
  if (!gate.ok) return gate;
  const role = String(gate.user.role || "").toLowerCase();
  const allowed = new Set(roles.map((r) => String(r).toLowerCase()));
  if (!allowed.has(role)) {
    warnSecurityEvent("access_denied", { reason: "role_not_allowed", role });
    return { ok: false, response: forbidden() };
  }
  return gate;
};

/** Platform administrator only. */
export const requireAdmin = async (request?: NextRequest) => requireRole(request, ["admin"]);

/** Supervisor or platform admin (admin may perform supervisor duties). */
export const requireSupervisor = async (request?: NextRequest) =>
  requireRole(request, ["supervisor", "admin"]);
