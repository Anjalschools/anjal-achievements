import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import PartnerOrganization from "@/models/PartnerOrganization";
import StudentTrainingApplication from "@/models/StudentTrainingApplication";
import TrainingOpportunity from "@/models/TrainingOpportunity";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { serializeTrainingApplication } from "@/lib/partnerships/partnerships-application-serialize";
import { requireStudentApplicant } from "@/lib/partnerships/partnerships-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const gate = await requireStudentApplicant();
  if (!gate.ok) return gate.response;

  try {
    await connectDB();
    const rows = await StudentTrainingApplication.find({ studentId: gate.user._id })
      .sort({ submittedAt: -1, createdAt: -1 })
      .lean();

    const opportunityIds = [...new Set(rows.map((row) => String(row.opportunityId)))];
    const opportunities = await TrainingOpportunity.find({ _id: { $in: opportunityIds } }).lean();
    const opportunityMap = new Map(opportunities.map((row) => [String(row._id), row]));

    const orgIds = [...new Set(opportunities.map((row) => String(row.organizationId)))];
    const organizations = await PartnerOrganization.find({ _id: { $in: orgIds } }).lean();
    const orgMap = new Map(organizations.map((row) => [String(row._id), row]));

    const items = await Promise.all(
      rows.map(async (row) => {
        const opportunity = opportunityMap.get(String(row.opportunityId));
        const organization = opportunity ? orgMap.get(String(opportunity.organizationId)) : undefined;
        return serializeTrainingApplication(row, {
          opportunityTitle: opportunity?.title || "",
          organizationName: organization?.name || "",
        });
      })
    );

    return NextResponse.json({ ok: true, items });
  } catch (error) {
    console.error("[GET /api/partnerships/my-applications]", error);
    return jsonInternalServerError(error);
  }
}
