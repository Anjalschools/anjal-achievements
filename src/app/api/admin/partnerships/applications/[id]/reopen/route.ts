import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { loadPartnershipApplicationDetail } from "@/lib/partnerships/partnerships-application-loader";
import { reopenRejectedTrainingApplication } from "@/lib/partnerships/partnerships-application-reopen-service";
import { requirePartnershipsReopenApplication } from "@/lib/partnerships/partnerships-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: { id: string } };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const gate = await requirePartnershipsReopenApplication();
  if (!gate.ok) return gate.response;

  const id = String(params.id || "").trim();
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const reason = body.reason !== undefined ? String(body.reason) : undefined;

    const result = await reopenRejectedTrainingApplication({
      applicationId: id,
      actor: gate.user,
      reason,
      request,
    });

    if (!result.ok) {
      const status = result.code === "not_found" ? 404 : 400;
      return NextResponse.json({ error: result.error, code: result.code }, { status });
    }

    const item = await loadPartnershipApplicationDetail(id, {
      includeReviewContext: true,
      locale: "ar",
    });

    return NextResponse.json({
      ok: true,
      item,
      fromStatus: result.fromStatus,
      toStatus: result.toStatus,
    });
  } catch (error) {
    console.error("[POST /api/admin/partnerships/applications/[id]/reopen]", error);
    return jsonInternalServerError(error);
  }
}
