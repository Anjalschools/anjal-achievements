import { NextResponse } from "next/server";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { requirePartnershipsView } from "@/lib/partnerships/partnerships-auth";
import { listFinalEvaluationsForSupervisor } from "@/lib/partnerships/training-final-evaluation-supervisor-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const gate = await requirePartnershipsView();
  if (!gate.ok) return gate.response;

  try {
    const items = await listFinalEvaluationsForSupervisor();
    return NextResponse.json({ ok: true, items });
  } catch (error) {
    console.error("[GET /api/admin/partnerships/final-evaluations]", error);
    return jsonInternalServerError(error);
  }
}
