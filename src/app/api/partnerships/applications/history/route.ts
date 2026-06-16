import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import PartnerOrganization from "@/models/PartnerOrganization";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import TrainingOpportunity from "@/models/TrainingOpportunity";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { serializeTrainingApplication } from "@/lib/partnerships/partnerships-application-serialize";
import { requireStudentApplicant } from "@/lib/partnerships/partnerships-auth";
import { ADMINISTRATIVELY_CANCELLED_STATUS } from "@/lib/partnerships/partnerships-admin-cancel-constants";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const HISTORICAL_STATUSES = [
  ADMINISTRATIVELY_CANCELLED_STATUS,
  "rejected",
  "withdrawn",
  "completed",
] as const;

export async function GET() {
  const gate = await requireStudentApplicant();
  if (!gate.ok) return gate.response;

  try {
    await connectDB();
    const rows = await StudentTrainingApplication.find({
      studentId: gate.user._id,
      status: { $in: [...HISTORICAL_STATUSES] },
    })
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean();

    const opportunityIds = [...new Set(rows.map((row) => String(row.opportunityId)))];
    const opportunities = await TrainingOpportunity.find({ _id: { $in: opportunityIds } })
      .select("title organizationId")
      .lean();
    const opportunityMap = new Map(opportunities.map((row) => [String(row._id), row]));

    const organizationIds = [
      ...new Set(opportunities.map((row) => String(row.organizationId)).filter(Boolean)),
    ];
    const organizations = await PartnerOrganization.find({ _id: { $in: organizationIds } })
      .select("name")
      .lean();
    const orgMap = new Map(organizations.map((row) => [String(row._id), row]));

    const items = await Promise.all(
      rows.map(async (row) => {
        const opportunity = opportunityMap.get(String(row.opportunityId));
        const organization = opportunity
          ? orgMap.get(String(opportunity.organizationId))
          : undefined;
        return serializeTrainingApplication(row, {
          opportunityTitle: opportunity?.title || "",
          organizationName: organization?.name || "",
        });
      })
    );

    return NextResponse.json({ ok: true, items });
  } catch (error) {
    console.error("[GET /api/partnerships/applications/history]", error);
    return jsonInternalServerError(error);
  }
}
