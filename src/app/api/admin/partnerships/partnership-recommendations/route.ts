import { NextResponse } from "next/server";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { requirePartnershipsView } from "@/lib/partnerships/partnerships-auth";
import { buildPartnershipExecutiveIntelligence } from "@/lib/partnerships/partnership-recommendation-engine-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const gate = await requirePartnershipsView();
  if (!gate.ok) return gate.response;

  try {
    const intelligence = await buildPartnershipExecutiveIntelligence();
    return NextResponse.json({ ok: true, intelligence });
  } catch (error) {
    console.error("[GET /api/admin/partnerships/partnership-recommendations]", error);
    return jsonInternalServerError(error);
  }
}
