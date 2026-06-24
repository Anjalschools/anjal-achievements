import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAdmin, type AuthGuardResult } from "@/lib/auth-guard";

/** Platform system administrator (`admin` role — maps from systemAdmin in auth-default-route). */
export const requireSystemAdmin = async (request?: NextRequest): Promise<AuthGuardResult> => {
  console.log("[DR-AUTH] ENTER");
  return requireAdmin(request);
};

export const assertSystemAdmin = async (
  request?: NextRequest
): Promise<{ user: NonNullable<Extract<AuthGuardResult, { ok: true }>["user"]> }> => {
  const gate = await requireSystemAdmin(request);
  if (!gate.ok) {
    throw gate.response;
  }
  return { user: gate.user };
};

export const systemAdminForbiddenResponse = () =>
  NextResponse.json({ error: "Forbidden — system administrator only" }, { status: 403 });
