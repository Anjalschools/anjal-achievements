import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import PartnerOrganization from "@/models/PartnerOrganization";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { buildInstitutionApplicantDashboard } from "@/lib/partnerships/institution-analytics-service";
import { requirePartnershipsView } from "@/lib/partnerships/partnerships-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: { id: string } };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const gate = await requirePartnershipsView();
  if (!gate.ok) return gate.response;

  const id = String(params.id || "").trim();
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const academicYear = request.nextUrl.searchParams.get("academicYear")?.trim() || undefined;

  try {
    await connectDB();
    const organization = await PartnerOrganization.findById(id).lean();
    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const stats = await buildInstitutionApplicantDashboard(id, academicYear);
    return NextResponse.json({ ok: true, stats });
  } catch (error) {
    console.error("[GET /api/admin/partnerships/organizations/[id]/applicant-dashboard]", error);
    return jsonInternalServerError(error);
  }
}
