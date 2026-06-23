import { NextResponse } from "next/server";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { PERMISSIONS } from "@/constants/permissions";
import { requireSession } from "@/lib/auth-guard";
import { requirePermission } from "@/lib/requirePermission";
import { buildExecutiveTalentIntelligence } from "@/lib/talent-pathway/talent-pathway-intelligence-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const gate = await requireSession();
  if (!gate.ok) return gate.response;

  const allowed = await requirePermission(gate.user, PERMISSIONS.analyticsView);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const intelligence = await buildExecutiveTalentIntelligence();
    return NextResponse.json({ ok: true, intelligence });
  } catch (error) {
    console.error("[GET /api/admin/talent-pathway/intelligence]", error);
    return jsonInternalServerError(error);
  }
}
