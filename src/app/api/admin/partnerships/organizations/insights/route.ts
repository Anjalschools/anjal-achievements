import { NextResponse } from "next/server";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { requirePartnershipsView } from "@/lib/partnerships/partnerships-auth";
import { buildGlobalInstitutionInsights } from "@/lib/partnerships/institution-analytics-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const gate = await requirePartnershipsView();
  if (!gate.ok) return gate.response;

  try {
    const insights = await buildGlobalInstitutionInsights();
    return NextResponse.json({ ok: true, insights });
  } catch (error) {
    console.error("[GET /api/admin/partnerships/organizations/insights]", error);
    return jsonInternalServerError(error);
  }
}
