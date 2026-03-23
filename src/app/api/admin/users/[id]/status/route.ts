import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireAdminUserManager } from "@/lib/admin-user-management-auth";
import { adminSetUserStatus } from "@/lib/admin-users-service";

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
    const body = (await request.json()) as { status?: string };
    const s = String(body.status || "");
    if (s !== "active" && s !== "inactive" && s !== "suspended") {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    await adminSetUserStatus(id, s, actorId(gate.user));
    return NextResponse.json({ ok: true, status: s });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    console.error("[PATCH /api/admin/users/[id]/status]", e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
