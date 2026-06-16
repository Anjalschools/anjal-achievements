import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import TrainingFinalInstitutionEvaluation from "@/models/TrainingFinalInstitutionEvaluation";
import TrainingFinalStudentEvaluation from "@/models/TrainingFinalStudentEvaluation";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { requireStudentApplicant } from "@/lib/partnerships/partnerships-auth";
import { canStudentAccessFinalReport } from "@/lib/partnerships/training-final-evaluation-access";

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

  const allowed = await canStudentAccessFinalReport(applicationId, String(gate.user._id));
  if (!allowed) {
    return NextResponse.json({ error: "Not eligible" }, { status: 403 });
  }

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

    return NextResponse.json({
      ok: true,
      application: {
        id: String(application._id),
        status: application.status,
      },
      studentEvaluation,
      institutionEvaluation,
      supervisorDecision: institutionEvaluation?.supervisorReviewStatus || "pending",
      supervisorNotes: institutionEvaluation?.supervisorReviewNotes || "",
      aiVerification: institutionEvaluation?.aiVerification || null,
    });
  } catch (error) {
    console.error("[GET final-report]", error);
    return jsonInternalServerError(error);
  }
}
