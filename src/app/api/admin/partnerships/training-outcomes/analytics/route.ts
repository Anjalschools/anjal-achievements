import { NextRequest, NextResponse } from "next/server";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { requirePartnershipsView } from "@/lib/partnerships/partnerships-auth";
import { buildTrainingOutcomeAnalytics } from "@/lib/partnerships/training-outcome-analytics";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const gate = await requirePartnershipsView();
    if (!gate.ok) return gate.response;

    const academicYearLabel = request.nextUrl.searchParams.get("academicYearLabel")?.trim() || undefined;
    const analytics = await buildTrainingOutcomeAnalytics(academicYearLabel);

    return NextResponse.json({ ok: true, item: analytics });
  } catch (error) {
    console.error("[GET /api/admin/partnerships/training-outcomes/analytics]", error);
    return jsonInternalServerError(error);
  }
}
