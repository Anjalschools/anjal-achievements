import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { buildStudentTrainingPortfolio } from "@/lib/partnerships/training-portfolio-service";
import { buildGraduateReadinessWidget } from "@/lib/partnerships/training-portfolio-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Alumni bridge — read-only training outcomes for graduated students. */
export async function GET() {
  try {
    const user = await getCurrentDbUser();
    if (!user?._id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const accountType = String(user.accountType || "student").trim().toLowerCase();
    if (accountType !== "alumni") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const studentId = String(user._id);
    const [portfolio, readiness] = await Promise.all([
      buildStudentTrainingPortfolio(studentId, "ar"),
      buildGraduateReadinessWidget(studentId),
    ]);

    return NextResponse.json({
      ok: true,
      item: {
        portfolio,
        readiness,
      },
    });
  } catch (error) {
    console.error("[GET /api/alumni/training-outcomes]", error);
    return jsonInternalServerError(error);
  }
}
