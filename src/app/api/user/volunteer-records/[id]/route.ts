import { NextRequest, NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import {
  deleteVolunteerRecord,
  updateVolunteerRecord,
} from "@/lib/career/volunteer-record-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: { id: string } };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (String(user.role) !== "student") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const item = await updateVolunteerRecord(String(user._id), params.id, {
      title: body.title != null ? String(body.title) : undefined,
      organization: body.organization != null ? String(body.organization) : undefined,
      description: body.description != null ? String(body.description) : undefined,
      hours: body.hours != null ? Number(body.hours) : undefined,
      startDate: body.startDate ? String(body.startDate) : undefined,
      endDate: body.endDate ? String(body.endDate) : undefined,
      submit: body.submit === true,
    });

    return NextResponse.json({ ok: true, item });
  } catch (error) {
    console.error("[PATCH /api/user/volunteer-records/[id]]", error);
    return jsonInternalServerError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (String(user.role) !== "student") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await deleteVolunteerRecord(String(user._id), params.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DELETE /api/user/volunteer-records/[id]]", error);
    return jsonInternalServerError(error);
  }
}
