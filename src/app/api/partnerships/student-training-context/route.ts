import { NextResponse } from "next/server";
import { requireStudentApplicant } from "@/lib/partnerships/partnerships-auth";
import {
  createFallbackStudentTrainingDashboardContext,
  loadStudentTrainingDashboardContext,
} from "@/lib/partnerships/partnerships-student-dashboard-context";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const gate = await requireStudentApplicant();
  if (!gate.ok) return gate.response;

  try {
    const context = await loadStudentTrainingDashboardContext(gate.user._id);
    return NextResponse.json({ ok: true, context });
  } catch (error) {
    console.error("[GET /api/partnerships/student-training-context]", error);
    return NextResponse.json({
      ok: true,
      context: createFallbackStudentTrainingDashboardContext(),
      degraded: true,
    });
  }
}
