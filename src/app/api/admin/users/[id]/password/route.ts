import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireAdminUserManager } from "@/lib/admin-user-management-auth";
import { adminSetUserPassword } from "@/lib/admin-users-service";

export const dynamic = "force-dynamic";

type RouteParams = { params: { id: string } };

const actorId = (u: unknown): string => {
  const o = u as { _id?: unknown };
  return o._id ? String(o._id) : "";
};

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;

  const id = params.id;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as { password?: string; passwordConfirm?: string };
    const password = String(body.password || "");
    const passwordConfirm = String(body.passwordConfirm || "");
    if (password !== passwordConfirm) {
      return NextResponse.json({ error: "Passwords do not match" }, { status: 400 });
    }
    await adminSetUserPassword(id, password, actorId(gate.user));
    return NextResponse.json({ ok: true, message: "Password updated" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    console.error("[PATCH /api/admin/users/[id]/password]", e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
