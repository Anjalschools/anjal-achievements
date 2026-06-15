import { NextRequest, NextResponse } from "next/server";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import {
  generateInstitutionAnnualReview,
  upsertInstitutionPerformanceSnapshot,
} from "@/lib/partnerships/institution-performance-intelligence-service";
import { requirePartnershipsManage } from "@/lib/partnerships/partnerships-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  const gate = await requirePartnershipsManage();
  if (!gate.ok) return gate.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const organizationId = String(body.organizationId || "").trim();
    const action = String(body.action || "snapshot").trim();

    if (!organizationId) {
      return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
    }

    if (action === "annual_review") {
      const review = await generateInstitutionAnnualReview(organizationId, {
        academicYearId: body.academicYearId ? String(body.academicYearId) : undefined,
        academicYearLabel: body.academicYearLabel ? String(body.academicYearLabel) : undefined,
        generatedBy: String(gate.user._id),
      });
      return NextResponse.json({ ok: true, review });
    }

    const snapshot = await upsertInstitutionPerformanceSnapshot(organizationId, {
      academicYearId: body.academicYearId ? String(body.academicYearId) : undefined,
      academicYearLabel: body.academicYearLabel ? String(body.academicYearLabel) : undefined,
    });
    return NextResponse.json({ ok: true, snapshot });
  } catch (error) {
    console.error("[POST /api/admin/partnerships/intelligence/snapshots]", error);
    return jsonInternalServerError(error);
  }
}
