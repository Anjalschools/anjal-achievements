import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import PartnerOrganization from "@/models/PartnerOrganization";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { requirePartnershipsView } from "@/lib/partnerships/partnerships-auth";
import {
  buildGlobalInstitutionInsights,
  buildOrganizationPerformanceStats,
} from "@/lib/partnerships/institution-analytics-service";
import { serializePartnerOrganization } from "@/lib/partnerships/partnerships-serialize";
import { PARTNER_ORGANIZATION_CATEGORY_LABELS } from "@/lib/partnerships/institution-analytics-constants";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: { id: string } };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const gate = await requirePartnershipsView();
  if (!gate.ok) return gate.response;

  const id = String(params.id || "").trim();
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    await connectDB();
    const organization = await PartnerOrganization.findById(id).lean();
    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const [stats, insights] = await Promise.all([
      buildOrganizationPerformanceStats(id),
      buildGlobalInstitutionInsights(),
    ]);

    const categoryLabel =
      organization.category && PARTNER_ORGANIZATION_CATEGORY_LABELS[organization.category]
        ? PARTNER_ORGANIZATION_CATEGORY_LABELS[organization.category]
        : null;

    return NextResponse.json({
      ok: true,
      organization: serializePartnerOrganization(organization),
      categoryLabel,
      stats,
      insights,
    });
  } catch (error) {
    console.error("[GET /api/admin/partnerships/organizations/[id]/analytics]", error);
    return jsonInternalServerError(error);
  }
}
