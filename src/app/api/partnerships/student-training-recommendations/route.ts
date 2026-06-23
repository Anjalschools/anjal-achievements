import { NextResponse } from "next/server";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { requireStudentApplicant } from "@/lib/partnerships/partnerships-auth";
import { buildStudentTrainingRecommendations } from "@/lib/partnerships/partnership-recommendation-engine-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const gate = await requireStudentApplicant();
  if (!gate.ok) return gate.response;

  try {
    const payload = await buildStudentTrainingRecommendations(String(gate.user._id));
    return NextResponse.json({ ok: true, ...payload });
  } catch (error) {
    console.error("[GET /api/partnerships/student-training-recommendations]", error);
    return jsonInternalServerError(error);
  }
}
