import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { requireStudentApplicant } from "@/lib/partnerships/partnerships-auth";
import { canStudentAccessFinalEvaluation } from "@/lib/partnerships/training-final-evaluation-access";
import { buildDraftStudentFinalReportPdfBuffer } from "@/lib/partnerships/training-final-report-pdf-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: { id: string } };

export async function POST(request: NextRequest, { params }: RouteParams) {
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
    const draft = (await request.json()) as Record<string, unknown>;
    const buffer = await buildDraftStudentFinalReportPdfBuffer({ applicationId, draft });
    if (!buffer) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="training-final-preview-${applicationId}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[POST final-evaluation/student/preview-report]", error);
    return jsonInternalServerError(error);
  }
}
