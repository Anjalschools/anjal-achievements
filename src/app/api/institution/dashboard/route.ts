import { NextResponse } from "next/server";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { buildInstitutionPortalDashboard } from "@/lib/partnerships/institution-portal-profile-service";
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
    const [dashboard, pipeline, analytics] = await Promise.all([
      buildInstitutionPortalDashboard(organizationId),
      listInstitutionCandidatePipeline(organizationId),
      buildInstitutionRecruitmentAnalytics(organizationId),
    ]);

    return NextResponse.json({
      ok: true,
      organization: gate.organization,
      profile: dashboard.profile,
      recentActivity: dashboard.recentActivity,
      measuredAt: dashboard.measuredAt,
      items: pipeline.items,
      stageCounts: pipeline.stageCounts,
      analytics,
      counts: pipeline.stageCounts,
    });
  } catch (error) {
    console.error("[GET /api/institution/dashboard]", error);
    return jsonInternalServerError(error);
  }
}
