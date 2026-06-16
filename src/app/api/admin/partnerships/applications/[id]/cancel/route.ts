import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { administrativelyCancelTrainingApplication } from "@/lib/partnerships/partnerships-application-admin-cancel-service";
import { loadPartnershipApplicationDetail } from "@/lib/partnerships/partnerships-application-loader";
import { requireSystemAdminTrainingCancel } from "@/lib/partnerships/partnerships-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: { id: string } };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const gate = await requireSystemAdminTrainingCancel();
  if (!gate.ok) return gate.response;

  const id = String(params.id || "").trim();
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const reasonCode = String(body.reasonCode || "").trim();
    const reasonNote = body.reasonNote !== undefined ? String(body.reasonNote) : undefined;

    const result = await administrativelyCancelTrainingApplication({
      applicationId: id,
      actor: gate.user,
      reasonCode,
      reasonNote,
      request,
    });

    if (!result.ok) {
      const status =
        result.code === "not_found" ? 404 : result.code === "has_achievement" || result.code === "has_completion_record" || result.code === "completed_application" ? 409 : 400;
      return NextResponse.json(
        { error: result.error, errorEn: result.errorEn, code: result.code },
        { status }
      );
    }

    const item = await loadPartnershipApplicationDetail(id, {
      includeReviewContext: true,
      locale: "ar",
    });

    return NextResponse.json({
      ok: true,
      item,
      previousStatus: result.previousStatus,
      cancelledAt: result.cancelledAt,
    });
  } catch (error) {
    console.error("[POST /api/admin/partnerships/applications/[id]/cancel]", error);
    return jsonInternalServerError(error);
  }
}
