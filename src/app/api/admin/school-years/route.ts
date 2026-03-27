import { NextRequest, NextResponse } from "next/server";
import { requireAdminUserManager } from "@/lib/admin-user-management-auth";
import connectDB from "@/lib/mongodb";
import SchoolYear from "@/models/SchoolYear";
import { listSchoolYears } from "@/lib/school-year-service";
import { logAuditEvent, actorFromUser } from "@/lib/audit-log-service";
import type { IUser } from "@/models/User";
import { jsonInternalServerError } from "@/lib/api-safe-response";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;
  try {
    const items = await listSchoolYears();
    return NextResponse.json({ ok: true, items });
  } catch (e) {
    console.error("[GET /api/admin/school-years]", e);
    return jsonInternalServerError(e);
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const name = String(body.name || "").trim();
    const start = body.startDate ? new Date(String(body.startDate)) : null;
    const end = body.endDate ? new Date(String(body.endDate)) : null;
    if (!name || !start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return NextResponse.json({ error: "Invalid name or dates" }, { status: 400 });
    }
    if (end <= start) {
      return NextResponse.json({ error: "endDate must be after startDate" }, { status: 400 });
    }
    await connectDB();
    const doc = await SchoolYear.create({
      name,
      startDate: start,
      endDate: end,
      status: (body.status as string) === "active" ? "active" : "draft",
      isCurrent: false,
      notes: body.notes ? String(body.notes).slice(0, 4000) : undefined,
    });
    await logAuditEvent({
      actionType: "school_year_created",
      entityType: "school_year",
      entityId: String(doc._id),
      entityTitle: name,
      descriptionAr: `تم إنشاء عام دراسي: ${name}`,
      metadata: { name },
      actor: actorFromUser(gate.user as IUser),
      request,
    });
    return NextResponse.json({ ok: true, item: doc.toObject() });
  } catch (e) {
    console.error("[POST /api/admin/school-years]", e);
    return jsonInternalServerError(e);
  }
}
