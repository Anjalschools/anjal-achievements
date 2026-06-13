import { NextRequest, NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import {
  createVolunteerRecord,
  listVolunteerRecords,
} from "@/lib/career/volunteer-record-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const user = await getCurrentDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (String(user.role) !== "student") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const items = await listVolunteerRecords(String(user._id));
    return NextResponse.json({ ok: true, items });
  } catch (error) {
    console.error("[GET /api/user/volunteer-records]", error);
    return jsonInternalServerError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentDbUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (String(user.role) !== "student") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const item = await createVolunteerRecord(String(user._id), {
      title: String(body.title || ""),
      organization: String(body.organization || ""),
      description: String(body.description || ""),
      hours: Number(body.hours) || 0,
      startDate: body.startDate ? String(body.startDate) : undefined,
      endDate: body.endDate ? String(body.endDate) : undefined,
      submit: body.submit === true,
    });

    return NextResponse.json({ ok: true, item }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/user/volunteer-records]", error);
    return jsonInternalServerError(error);
  }
}
