import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { requireStudentApplicant } from "@/lib/partnerships/partnerships-auth";
import { canStudentAccessFinalEvaluation } from "@/lib/partnerships/training-final-evaluation-access";
import {
  getStudentFinalEvaluation,
  submitStudentFinalEvaluation,
} from "@/lib/partnerships/training-final-student-evaluation-service";
import { resolveFinalEvaluationContext } from "@/lib/partnerships/training-final-evaluation-access";
import { computeOpportunityRequiredTrainingHours } from "@/lib/partnerships/training-final-evaluation-ui-constants";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: { id: string } };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const gate = await requireStudentApplicant();
  if (!gate.ok) return gate.response;

  const applicationId = String(params.id || "").trim();
  if (!mongoose.Types.ObjectId.isValid(applicationId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const access = await canStudentAccessFinalEvaluation(applicationId, String(gate.user._id));
  if (!access.ok) {
    return NextResponse.json({ error: "Not eligible", code: access.reason }, { status: 403 });
  }

  try {
    const evaluation = await getStudentFinalEvaluation(applicationId, String(gate.user._id));
    const ctx = await resolveFinalEvaluationContext(applicationId);
    const context = ctx
      ? {
          institutionName: ctx.organization?.name || "",
          opportunityTitle: ctx.opportunity?.title || "",
          trainingStartDate: ctx.opportunity?.trainingStart || null,
          trainingEndDate: ctx.opportunity?.trainingEnd || null,
          applicationStatus: ctx.application.status,
          opportunityRequiredHours: computeOpportunityRequiredTrainingHours(
            ctx.opportunity?.trainingStart,
            ctx.opportunity?.trainingEnd
          ),
        }
      : null;
    return NextResponse.json({ ok: true, evaluation, context });
  } catch (error) {
    console.error("[GET final-evaluation/student]", error);
    return jsonInternalServerError(error);
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const gate = await requireStudentApplicant();
  if (!gate.ok) return gate.response;

  const applicationId = String(params.id || "").trim();
  if (!mongoose.Types.ObjectId.isValid(applicationId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const result = await submitStudentFinalEvaluation({
      applicationId,
      student: gate.user,
      payload: body,
      request,
    });

    if (!result.ok) {
      const status = result.code === "not_found" ? 404 : result.code === "locked" ? 409 : 400;
      return NextResponse.json({ error: result.error, code: result.code }, { status });
    }

    const evaluation = await getStudentFinalEvaluation(applicationId, String(gate.user._id));
    return NextResponse.json({ ok: true, id: result.id, evaluation });
  } catch (error) {
    console.error("[POST final-evaluation/student]", error);
    return jsonInternalServerError(error);
  }
}
