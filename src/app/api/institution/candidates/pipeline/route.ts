import { NextRequest, NextResponse } from "next/server";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import {
  buildInstitutionRecruitmentAnalytics,
  listInstitutionCandidatePipeline,
} from "@/lib/partnerships/institution-candidate-pipeline-service";
import { requireTrainingInstitution } from "@/lib/partnerships/partnerships-institution-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const gate = await requireTrainingInstitution();
  if (!gate.ok) return gate.response;

  const organizationId = gate.organization?.id;
  if (!organizationId) {
    return NextResponse.json({ error: "Institution organization not linked" }, { status: 403 });
  }

  try {
    const [pipeline, analytics] = await Promise.all([
      listInstitutionCandidatePipeline(organizationId),
      buildInstitutionRecruitmentAnalytics(organizationId),
    ]);

    return NextResponse.json({
      ok: true,
      items: pipeline.items,
      stageCounts: pipeline.stageCounts,
      analytics,
    });
  } catch (error) {
    console.error("[GET /api/institution/candidates/pipeline]", error);
    return jsonInternalServerError(error);
  }
}
