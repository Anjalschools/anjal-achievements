import { NextRequest, NextResponse } from "next/server";
import { actorFromUser } from "@/lib/audit-log-service";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { requireAcademicYearAdmin, requireAcademicYearRead } from "@/lib/academic-years/academic-year-auth";
import { createAcademicYear, listAcademicYears, summarizeAcademicYears } from "@/lib/academic-years/academic-year-service";
import { getPromotionPreview } from "@/lib/academic-years/promotion-preview";
import type { IUser } from "@/models/User";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const gate = await requireAcademicYearRead();
  if (!gate.ok) return gate.response;

  try {
    const includePreview = new URL(request.url).searchParams.get("preview") === "1";
    const items = await listAcademicYears();
    const payload: Record<string, unknown> = {
      ok: true,
      items,
      canManage: gate.canManage,
      summary: await summarizeAcademicYears(),
    };
    if (includePreview && gate.canManage) {
      payload.promotionPreview = await getPromotionPreview();
    }
    return NextResponse.json(payload);
  } catch (error) {
    console.error("[GET /api/admin/academic-years]", error);
    return jsonInternalServerError(error);
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireAcademicYearAdmin();
  if (!gate.ok) return gate.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const name = String(body.name || "").trim();
    const label = String(body.label || "").trim() || undefined;
    const start = body.startDate ? new Date(String(body.startDate)) : null;
    const end = body.endDate ? new Date(String(body.endDate)) : null;
    if (!name || !start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return NextResponse.json({ error: "Invalid name or dates" }, { status: 400 });
    }

    const item = await createAcademicYear({
      name,
      label,
      startDate: start,
      endDate: end,
      actor: actorFromUser(gate.user as IUser),
      request,
    });

    return NextResponse.json({ ok: true, item }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/admin/academic-years]", error);
    return jsonInternalServerError(error);
  }
}
