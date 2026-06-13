import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { actorFromUser } from "@/lib/audit-log-service";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { requireAcademicYearAdmin, requireAcademicYearRead } from "@/lib/academic-years/academic-year-auth";
import {
  deleteAcademicYear,
  getAcademicYearById,
  lockAcademicYear,
  setAcademicYearAsCurrent,
  unlockAcademicYear,
  updateAcademicYear,
} from "@/lib/academic-years/academic-year-service";
import type { IUser } from "@/models/User";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: { id: string } };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const gate = await requireAcademicYearRead();
  if (!gate.ok) return gate.response;

  const id = String(params.id || "").trim();
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const item = await getAcademicYearById(id);
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true, item, canManage: gate.canManage });
  } catch (error) {
    console.error("[GET /api/admin/academic-years/[id]]", error);
    return jsonInternalServerError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const gate = await requireAcademicYearAdmin();
  if (!gate.ok) return gate.response;

  const id = String(params.id || "").trim();
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action || "").trim();
    const actor = actorFromUser(gate.user as IUser);

    if (action === "set_current") {
      const item = await setAcademicYearAsCurrent({ id, actor, request });
      return NextResponse.json({ ok: true, item });
    }
    if (action === "lock") {
      const item = await lockAcademicYear({ id, actor, request });
      return NextResponse.json({ ok: true, item });
    }
    if (action === "unlock") {
      const item = await unlockAcademicYear({ id, actor, request });
      return NextResponse.json({ ok: true, item });
    }

    const patch: {
      name?: string;
      label?: string;
      startDate?: Date;
      endDate?: Date;
    } = {};
    if (body.name != null) patch.name = String(body.name).trim();
    if (body.label != null) patch.label = String(body.label).trim();
    if (body.startDate) {
      const start = new Date(String(body.startDate));
      if (Number.isNaN(start.getTime())) {
        return NextResponse.json({ error: "Invalid startDate" }, { status: 400 });
      }
      patch.startDate = start;
    }
    if (body.endDate) {
      const end = new Date(String(body.endDate));
      if (Number.isNaN(end.getTime())) {
        return NextResponse.json({ error: "Invalid endDate" }, { status: 400 });
      }
      patch.endDate = end;
    }

    const item = await updateAcademicYear({ id, patch, actor, request });
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error";
    const status = message.includes("locked") ? 409 : 400;
    console.error("[PATCH /api/admin/academic-years/[id]]", error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const gate = await requireAcademicYearAdmin();
  if (!gate.ok) return gate.response;

  const id = String(params.id || "").trim();
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    await deleteAcademicYear({
      id,
      actor: actorFromUser(gate.user as IUser),
      request,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error";
    console.error("[DELETE /api/admin/academic-years/[id]]", error);
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
