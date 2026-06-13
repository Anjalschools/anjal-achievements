import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { timelineActionLabel } from "@/lib/partnerships/partnerships-application-workflow";
import { requirePartnershipsView } from "@/lib/partnerships/partnerships-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: { id: string } };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const gate = await requirePartnershipsView();
  if (!gate.ok) return gate.response;

  const id = String(params.id || "").trim();
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    await connectDB();
    const row = await StudentTrainingApplication.findById(id).select("timeline status submittedAt").lean();
    if (!row) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    const locale = new URL(request.url).searchParams.get("locale") === "en" ? "en" : "ar";
    const isAr = locale === "ar";
    const events = Array.isArray(row.timeline) ? row.timeline : [];

    const items = events.map((event) => ({
      at: event.at ? new Date(event.at).toISOString() : null,
      action: event.action,
      label: timelineActionLabel(String(event.action || ""), isAr),
      fromStatus: event.fromStatus || null,
      toStatus: event.toStatus || null,
      actorId: event.actorId || null,
      actorName: event.actorName || null,
      note: event.note || null,
    }));

    return NextResponse.json({
      ok: true,
      status: row.status,
      submittedAt: row.submittedAt ? new Date(row.submittedAt).toISOString() : null,
      items,
    });
  } catch (error) {
    console.error("[GET /api/admin/partnerships/applications/[id]/timeline]", error);
    return jsonInternalServerError(error);
  }
}
