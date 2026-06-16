import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import PartnerOrganization from "@/models/PartnerOrganization";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import TrainingOpportunity from "@/models/TrainingOpportunity";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { serializeTrainingApplication } from "@/lib/partnerships/partnerships-application-serialize";
import { resolveAcademicYearForLegacyRecord } from "@/lib/academic-years/academic-year-display";
import {
  buildPartnershipApplicationsMongoFilter,
  computePartnershipApplicationsDashboard,
} from "@/lib/partnerships/partnerships-applications-query";
import { requirePartnershipsView } from "@/lib/partnerships/partnerships-auth";
import { canAdminCancelTrainingApplication } from "@/lib/partnerships/partnerships-admin-cancel-constants";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const parseFilters = (request: NextRequest) => {
  const params = new URL(request.url).searchParams;
  return {
    status: params.get("status")?.trim() || undefined,
    organizationId: params.get("organizationId")?.trim() || undefined,
    opportunityId: params.get("opportunityId")?.trim() || undefined,
    grade: params.get("grade")?.trim() || undefined,
    gender: params.get("gender")?.trim() || undefined,
    academicYear: params.get("academicYear")?.trim() || undefined,
  };
};

export async function GET(request: NextRequest) {
  const gate = await requirePartnershipsView();
  if (!gate.ok) return gate.response;

  try {
    await connectDB();
    const filters = parseFilters(request);
    const mongoFilter = await buildPartnershipApplicationsMongoFilter(filters);

    const [rows, organizations, opportunities] = await Promise.all([
      StudentTrainingApplication.find(mongoFilter).sort({ submittedAt: -1, createdAt: -1 }).lean(),
      PartnerOrganization.find({ active: { $ne: false } }).sort({ name: 1 }).select("name").lean(),
      TrainingOpportunity.find({ active: { $ne: false } }).sort({ title: 1 }).select("title organizationId").lean(),
    ]);

    const opportunityMap = new Map(opportunities.map((row) => [String(row._id), row]));
    const orgMap = new Map(organizations.map((row) => [String(row._id), row]));

    const items = await Promise.all(
      rows.map(async (row) => {
        const opportunity = opportunityMap.get(String(row.opportunityId));
        const organization = opportunity ? orgMap.get(String(opportunity.organizationId)) : undefined;
        return serializeTrainingApplication(row, {
          opportunityTitle: opportunity?.title || "",
          organizationName: organization?.name || "",
          organizationId: opportunity ? String(opportunity.organizationId) : "",
        });
      })
    );

    const isSystemAdmin = String(gate.user.role || "").trim() === "admin";
    const itemsWithCapabilities = items.map((item) => ({
      ...item,
      canAdminCancel: isSystemAdmin && canAdminCancelTrainingApplication(item.status),
    }));

    const academicYears = [
      ...new Set(
        await Promise.all(
          rows.map((row) =>
            resolveAcademicYearForLegacyRecord({
              academicYear: row.academicYear,
              academicYearLabel: row.academicYearLabel,
            })
          )
        )
      ),
    ].sort((a, b) => b.localeCompare(a));

    return NextResponse.json({
      ok: true,
      items: itemsWithCapabilities,
      dashboard: computePartnershipApplicationsDashboard(rows),
      filterOptions: {
        organizations: organizations.map((row) => ({ id: String(row._id), name: row.name })),
        opportunities: opportunities.map((row) => ({
          id: String(row._id),
          title: row.title,
          organizationId: String(row.organizationId),
        })),
        academicYears,
      },
    });
  } catch (error) {
    console.error("[GET /api/admin/partnerships/applications]", error);
    return jsonInternalServerError(error);
  }
}
