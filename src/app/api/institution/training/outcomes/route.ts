import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import TrainingOutcomeRecord from "@/models/TrainingOutcomeRecord";
import PartnerOrganization from "@/models/PartnerOrganization";
import User from "@/models/User";
import { resolveInstitutionOrganizationForUser } from "@/lib/partnerships/institution-portal-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { requireSession } = await import("@/lib/auth-guard");
    const gate = await requireSession();
    if (!gate.ok) return gate.response;

    const org = await resolveInstitutionOrganizationForUser(String(gate.user._id));
    if (!org?.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await connectDB();

    const rows = await TrainingOutcomeRecord.find({ institutionId: org.id })
      .sort({ approvedAt: -1 })
      .limit(200)
      .lean();

    const studentIds = [...new Set(rows.map((r) => String(r.studentId)))];
    const students = studentIds.length
      ? await User.find({ _id: { $in: studentIds } }).select("fullName fullNameAr grade").lean()
      : [];
    const studentMap = new Map(
      students.map((s) => [
        String(s._id),
        { name: String(s.fullNameAr || s.fullName || ""), grade: String((s as { grade?: string }).grade || "") },
      ])
    );

    const items = rows.map((r) => {
      const student = studentMap.get(String(r.studentId));
      return {
        id: String(r._id),
        applicationId: String(r.applicationId),
        studentId: String(r.studentId),
        studentName: student?.name || "",
        grade: student?.grade || "",
        trainingHours: r.trainingHours,
        employabilityScore: r.employabilityScore,
        readinessScore: r.readinessScore,
        outcomeLevel: r.outcomeLevel,
        recommendedForEmployment: r.recommendedForEmployment,
        recommendedForFutureTraining: r.recommendedForFutureTraining,
        approvedAt: new Date(r.approvedAt).toISOString(),
      };
    });

    return NextResponse.json({ ok: true, items });
  } catch (error) {
    console.error("[GET /api/institution/training/outcomes]", error);
    return jsonInternalServerError(error);
  }
}
