import { NextRequest, NextResponse } from "next/server";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import {
  compareInstitutionCandidates,
  recordCandidateComparison,
} from "@/lib/partnerships/institution-candidate-pipeline-service";
import { requireTrainingInstitution } from "@/lib/partnerships/partnerships-institution-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const gate = await requireTrainingInstitution();
  if (!gate.ok) return gate.response;

  const organizationId = gate.organization?.id;
  if (!organizationId) {
    return NextResponse.json({ error: "Institution organization not linked" }, { status: 403 });
  }

  const ids = new URL(request.url).searchParams.get("ids")?.split(",").map((s) => s.trim()).filter(Boolean) || [];

  try {
    const result = await compareInstitutionCandidates(ids, organizationId);
    if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: 400 });

    const actorName = String(
      gate.user.fullNameAr || gate.user.fullName || gate.organization?.name || gate.user.email || ""
    ).trim();

    await recordCandidateComparison({
      applicationIds: ids,
      organizationId,
      actorId: String(gate.user._id),
      actorName,
      request,
    });

    return NextResponse.json({ ok: true, candidates: result.candidates });
  } catch (error) {
    console.error("[GET /api/institution/candidates/compare]", error);
    return jsonInternalServerError(error);
  }
}
