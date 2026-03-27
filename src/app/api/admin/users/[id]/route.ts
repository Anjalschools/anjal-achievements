import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireAdminUserManager } from "@/lib/admin-user-management-auth";
import {
  adminDeleteUser,
  adminUpdateUser,
  getAdminUserById,
  type AdminUpdateUserInput,
} from "@/lib/admin-users-service";
import { isAdminManageableRole } from "@/lib/admin-users-constants";
import { jsonInternalServerError } from "@/lib/api-safe-response";

export const dynamic = "force-dynamic";

type RouteParams = { params: { id: string } };

const actorId = (u: unknown): string => {
  const o = u as { _id?: unknown };
  return o._id ? String(o._id) : "";
};

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;

  const id = params.id;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const user = await getAdminUserById(id);
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ user });
  } catch (e) {
    console.error("[GET /api/admin/users/[id]]", e);
    return jsonInternalServerError(e);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;

  const id = params.id;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const input: AdminUpdateUserInput = {};

    if (body.fullNameAr !== undefined) input.fullNameAr = String(body.fullNameAr);
    if (body.fullNameEn !== undefined) input.fullNameEn = String(body.fullNameEn);
    if (body.email !== undefined) input.email = String(body.email);
    if (body.username !== undefined) input.username = String(body.username);
    if (body.phone !== undefined) {
      input.phone = body.phone === null ? null : String(body.phone);
    }
    if (body.nationalId !== undefined) {
      input.nationalId = body.nationalId === null ? null : String(body.nationalId);
    }
    if (body.role !== undefined) {
      const r = String(body.role);
      if (!isAdminManageableRole(r)) {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      }
      input.role = r;
    }
    if (body.status !== undefined) {
      const s = String(body.status);
      if (s !== "active" && s !== "inactive" && s !== "suspended") {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      input.status = s;
    }
    if (body.gender !== undefined) input.gender = body.gender === "female" ? "female" : "male";
    if (body.section !== undefined) {
      input.section = body.section === "international" ? "international" : "arabic";
    }
    if (body.grade !== undefined) input.grade = String(body.grade);
    if (body.preferredLanguage !== undefined) {
      input.preferredLanguage = body.preferredLanguage === "en" ? "en" : "ar";
    }
    if (body.profilePhoto !== undefined) {
      input.profilePhoto = body.profilePhoto === null ? null : String(body.profilePhoto);
    }

    const user = await adminUpdateUser(id, input, actorId(gate.user));
    return NextResponse.json({ user });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    console.error("[PATCH /api/admin/users/[id]]", e);
    const status =
      msg.includes("already") || msg.includes("in use") ? 409 : msg.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;

  const id = params.id;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    await adminDeleteUser(id, actorId(gate.user));
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const code = (e as { code?: string }).code;
    if (code === "HAS_ACHIEVEMENTS") {
      return NextResponse.json({ error: msg, code }, { status: 409 });
    }
    console.error("[DELETE /api/admin/users/[id]]", e);
    return NextResponse.json({ error: msg }, { status: msg.includes("not found") ? 404 : 400 });
  }
}
