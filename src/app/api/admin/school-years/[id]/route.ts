import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireAdminUserManager } from "@/lib/admin-user-management-auth";
import connectDB from "@/lib/mongodb";
import SchoolYear from "@/models/SchoolYear";
import { archiveSchoolYear, setYearAsCurrent } from "@/lib/school-year-service";
import { logAuditEvent, actorFromUser } from "@/lib/audit-log-service";
import type { IUser } from "@/models/User";
import { jsonInternalServerError } from "@/lib/api-safe-response";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = { params: { id: string } };

export async function PATCH(request: NextRequest, { params }: Params) {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;
  const id = params.id;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  try {
    const body = (await request.json()) as Record<string, unknown>;
    await connectDB();
    const doc = await SchoolYear.findById(id);
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (body.action === "activate") {
      await setYearAsCurrent(id, {
        autoArchivePrevious: body.autoArchivePrevious === true,
      });
      await logAuditEvent({
        actionType: "school_year_activated",
        entityType: "school_year",
        entityId: id,
        entityTitle: doc.name,
        descriptionAr: `تم تعيين العام الدراسي الحالي: ${doc.name}`,
        actor: actorFromUser(gate.user as IUser),
        request,
      });
      const updated = await SchoolYear.findById(id).lean();
      return NextResponse.json({ ok: true, item: updated });
    }

    if (body.action === "archive") {
      await archiveSchoolYear(id);
      await logAuditEvent({
        actionType: "school_year_archived",
        entityType: "school_year",
        entityId: id,
        entityTitle: doc.name,
        descriptionAr: `تم أرشفة عام دراسي: ${doc.name}`,
        actor: actorFromUser(gate.user as IUser),
        request,
      });
      const updated = await SchoolYear.findById(id).lean();
      return NextResponse.json({ ok: true, item: updated });
    }

    if (typeof body.name === "string") doc.name = body.name.trim();
    if (body.startDate) doc.startDate = new Date(String(body.startDate));
    if (body.endDate) doc.endDate = new Date(String(body.endDate));
    if (body.notes !== undefined) doc.notes = String(body.notes).slice(0, 4000);
    if (body.status === "draft" || body.status === "active" || body.status === "archived") {
      doc.status = body.status;
    }
    await doc.save();

    await logAuditEvent({
      actionType: "admin_settings_updated",
      entityType: "school_year",
      entityId: id,
      entityTitle: doc.name,
      descriptionAr: "تم تعديل عام دراسي",
      actor: actorFromUser(gate.user as IUser),
      request,
    });

    return NextResponse.json({ ok: true, item: doc.toObject() });
  } catch (e) {
    console.error("[PATCH /api/admin/school-years/id]", e);
    return jsonInternalServerError(e);
  }
}
