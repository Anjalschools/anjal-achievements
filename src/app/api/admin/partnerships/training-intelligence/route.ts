import { NextResponse } from "next/server";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { requirePartnershipsView } from "@/lib/partnerships/partnerships-auth";
import { buildTrainingExecutiveAnalytics } from "@/lib/partnerships/training-intelligence-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const gate = await requirePartnershipsView();
  if (!gate.ok) return gate.response;

  try {
    const analytics = await buildTrainingExecutiveAnalytics();
    return NextResponse.json({ ok: true, analytics });
  } catch (error) {
    console.error("[GET /api/admin/partnerships/training-intelligence]", error);
    return jsonInternalServerError(error);
  }
}
