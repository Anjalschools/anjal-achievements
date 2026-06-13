import { NextResponse } from "next/server";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { getPartnershipSlaDashboard } from "@/lib/partnerships/partnerships-sla";
import { requirePartnershipsView } from "@/lib/partnerships/partnerships-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const gate = await requirePartnershipsView();
  if (!gate.ok) return gate.response;

  try {
    const sla = await getPartnershipSlaDashboard();
    return NextResponse.json({ ok: true, sla });
  } catch (error) {
    console.error("[GET /api/admin/partnerships/sla]", error);
    return jsonInternalServerError(error);
  }
}
