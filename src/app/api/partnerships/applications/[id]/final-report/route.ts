import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import TrainingFinalInstitutionEvaluation from "@/models/TrainingFinalInstitutionEvaluation";
import TrainingFinalStudentEvaluation from "@/models/TrainingFinalStudentEvaluation";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { requireStudentApplicant } from "@/lib/partnerships/partnerships-auth";
import { canStudentAccessFinalReport } from "@/lib/partnerships/training-final-evaluation-access";
import { buildApplicationFinalReportPdfBuffer } from "@/lib/partnerships/training-final-report-pdf-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: { id: string } };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const gate = await requireStudentApplicant();
  if (!gate.ok) return gate.response;

  const applicationId = String(params.id || "").trim();
  if (!mongoose.Types.ObjectId.isValid(applicationId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const allowed = await canStudentAccessFinalReport(applicationId, String(gate.user._id));
  if (!allowed) {
    return NextResponse.json({ error: "Not eligible" }, { status: 403 });
  }

  const exportPdf = request.nextUrl.searchParams.get("export") === "pdf";

  try {
    await connectDB();
    const application = await StudentTrainingApplication.findOne({
      _id: applicationId,
      studentId: gate.user._id,
    }).lean();
    if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const [studentEvaluation, institutionEvaluation] = await Promise.all([
      TrainingFinalStudentEvaluation.findOne({ applicationId }).lean(),
      TrainingFinalInstitutionEvaluation.findOne({ applicationId }).lean(),
    ]);

    if (exportPdf) {
      const buffer = await buildApplicationFinalReportPdfBuffer(applicationId);
      if (!buffer) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="training-final-report-${applicationId}.pdf"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const supervisorApproved =
      institutionEvaluation?.supervisorReviewStatus === "approved" ||
      application.status === "final_evaluation_approved";

    return NextResponse.json({
      ok: true,
      application: {
        id: String(application._id),
        status: application.status,
      },
      studentEvaluation,
      institutionEvaluation: supervisorApproved ? institutionEvaluation : null,
      institutionEvaluationVisible: supervisorApproved,
      supervisorDecision: institutionEvaluation?.supervisorReviewStatus || "pending",
      supervisorNotes: institutionEvaluation?.supervisorReviewNotes || "",
      aiVerification: supervisorApproved ? institutionEvaluation?.aiVerification || null : null,
    });
  } catch (error) {
    console.error("[GET final-report]", error);
    return jsonInternalServerError(error);
  }
}
