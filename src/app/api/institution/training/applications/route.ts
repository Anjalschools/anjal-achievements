import { NextRequest, NextResponse } from "next/server";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import {
  getInstitutionDashboardCounts,
  listInstitutionApplications,
} from "@/lib/partnerships/institution-portal-service";
import { requireTrainingInstitution } from "@/lib/partnerships/partnerships-institution-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const gate = await requireTrainingInstitution();
  if (!gate.ok) return gate.response;

  const organizationId =
    new URL(request.url).searchParams.get("organizationId")?.trim() || gate.organization?.id;
  if (!organizationId) {
    return NextResponse.json({ error: "Organization id is required" }, { status: 400 });
  }

  try {
    const items = await listInstitutionApplications(organizationId);
    const counts = await getInstitutionDashboardCounts(organizationId);
    const grouped = {
      new: items.filter((row) => row.status === "institution_review" && row.institutionStatus === "institution_pending"),
      inReview: items.filter(
        (row) =>
          row.status === "institution_review" &&
          row.institutionStatus &&
          row.institutionStatus !== "institution_pending"
      ),
      accepted: items.filter((row) => row.status === "accepted"),
      rejected: items.filter((row) => row.status === "rejected"),
      interview: items.filter((row) => row.status === "interview_requested"),
      inProgress: items.filter((row) => row.status === "accepted"),
      completed: items.filter((row) => row.status === "completed"),
    };

    return NextResponse.json({
      ok: true,
      organization: gate.organization,
      items,
      grouped,
      counts,
    });
  } catch (error) {
    console.error("[GET /api/institution/training/applications]", error);
    return jsonInternalServerError(error);
  }
}
