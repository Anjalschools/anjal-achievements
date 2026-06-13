import { NextResponse } from "next/server";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { requirePartnershipsView } from "@/lib/partnerships/partnerships-auth";
import { listTrainingAchievementsDashboard } from "@/lib/partnerships/training-achievements-query";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const gate = await requirePartnershipsView();
  if (!gate.ok) return gate.response;

  try {
    const result = await listTrainingAchievementsDashboard();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[GET /api/training-achievements]", error);
    return jsonInternalServerError(error);
  }
}
