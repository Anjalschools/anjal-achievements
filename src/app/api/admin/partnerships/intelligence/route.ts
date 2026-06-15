import { NextResponse } from "next/server";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { buildPartnershipIntelligenceDashboard } from "@/lib/partnerships/institution-performance-intelligence-service";
import { requirePartnershipsView } from "@/lib/partnerships/partnerships-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const gate = await requirePartnershipsView();
  if (!gate.ok) return gate.response;

  try {
    const dashboard = await buildPartnershipIntelligenceDashboard();
    return NextResponse.json({ ok: true, dashboard });
  } catch (error) {
    console.error("[GET /api/admin/partnerships/intelligence]", error);
    return jsonInternalServerError(error);
  }
}
