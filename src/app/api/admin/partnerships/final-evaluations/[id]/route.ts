import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { requirePartnershipsApprove } from "@/lib/partnerships/partnerships-auth";
import {
  getFinalEvaluationDetailForSupervisor,
  reviewFinalEvaluation,
  type SupervisorFinalEvaluationAction,
} from "@/lib/partnerships/training-final-evaluation-supervisor-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: { id: string } };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const gate = await requirePartnershipsApprove();
  if (!gate.ok) return gate.response;

  const applicationId = String(params.id || "").trim();
  if (!mongoose.Types.ObjectId.isValid(applicationId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const detail = await getFinalEvaluationDetailForSupervisor(applicationId);
    if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true, ...detail });
  } catch (error) {
    console.error("[GET final-evaluations/[id]]", error);
    return jsonInternalServerError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const gate = await requirePartnershipsApprove();
  if (!gate.ok) return gate.response;

  const applicationId = String(params.id || "").trim();
  if (!mongoose.Types.ObjectId.isValid(applicationId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action || "").trim() as SupervisorFinalEvaluationAction;
    if (!["approve", "reject", "request_resubmission"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const result = await reviewFinalEvaluation({
      applicationId,
      action,
      notes: body.notes !== undefined ? String(body.notes) : undefined,
      actor: gate.user,
      request,
    });

    if (!result.ok) {
      const status = result.code === "not_found" ? 404 : 400;
      return NextResponse.json({ error: result.error, code: result.code }, { status });
    }

    const detail = await getFinalEvaluationDetailForSupervisor(applicationId);
    return NextResponse.json({ ok: true, ...detail });
  } catch (error) {
    console.error("[PATCH final-evaluations/[id]]", error);
    return jsonInternalServerError(error);
  }
}
