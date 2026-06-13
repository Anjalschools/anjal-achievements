import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { actorFromUser } from "@/lib/audit-log-service";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { requireStudentApplicant } from "@/lib/partnerships/partnerships-auth";
import {
  getStudentFeedbackForApplication,
  submitStudentFeedback,
} from "@/lib/partnerships/institution-student-feedback-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: { id: string } };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const gate = await requireStudentApplicant();
  if (!gate.ok) return gate.response;

  const id = String(params.id || "").trim();
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const feedback = await getStudentFeedbackForApplication(id, gate.user._id);
    return NextResponse.json({ ok: true, feedback });
  } catch (error) {
    console.error("[GET /api/partnerships/applications/[id]/student-feedback]", error);
    return jsonInternalServerError(error);
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const gate = await requireStudentApplicant();
  if (!gate.ok) return gate.response;

  const id = String(params.id || "").trim();
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const feedback = await submitStudentFeedback({
      applicationId: id,
      studentId: gate.user._id,
      feedback: {
        overallRating: Number(body.overallRating),
        trainingQualityRating: Number(body.trainingQualityRating),
        supervisionRating: Number(body.supervisionRating),
        workEnvironmentRating: Number(body.workEnvironmentRating),
        benefitRating: Number(body.benefitRating),
        wouldRecommend: body.wouldRecommend === true || String(body.wouldRecommend) === "yes",
        studentFeedbackNotes:
          body.studentFeedbackNotes !== undefined ? String(body.studentFeedbackNotes) : undefined,
      },
      actor: actorFromUser(gate.user),
      request,
    });

    return NextResponse.json({ ok: true, feedback }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error";
    if (
      message.includes("not found") ||
      message.includes("only available") ||
      message.includes("between 1 and 5")
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("[POST /api/partnerships/applications/[id]/student-feedback]", error);
    return jsonInternalServerError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  return POST(request, { params });
}
