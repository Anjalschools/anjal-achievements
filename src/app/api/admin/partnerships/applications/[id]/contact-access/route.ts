import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import {
  buildSupervisorContactAccessView,
  grantOrUpdateContactAccess,
  revokeContactAccess,
} from "@/lib/partnerships/institution-contact-access-service";
import { requirePartnershipsContactAccessManage } from "@/lib/partnerships/partnerships-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: { id: string } };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const gate = await requirePartnershipsContactAccessManage();
  if (!gate.ok) return gate.response;

  const applicationId = String(params.id || "").trim();
  if (!mongoose.Types.ObjectId.isValid(applicationId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const view = await buildSupervisorContactAccessView(applicationId);
    if (!view) return NextResponse.json({ error: "Application not found" }, { status: 404 });
    return NextResponse.json({ ok: true, ...view });
  } catch (error) {
    console.error("[GET /api/admin/partnerships/applications/[id]/contact-access]", error);
    return jsonInternalServerError(error);
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const gate = await requirePartnershipsContactAccessManage();
  if (!gate.ok) return gate.response;

  const applicationId = String(params.id || "").trim();
  if (!mongoose.Types.ObjectId.isValid(applicationId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action || "grant").trim();
    const actorName = String(gate.user.fullNameAr || gate.user.fullName || gate.user.email || "").trim();
    const actor = { id: String(gate.user._id), name: actorName, role: String(gate.user.role || "admin") };

    if (action === "revoke") {
      const result = await revokeContactAccess({
        applicationId,
        actor,
        notes: body.notes ? String(body.notes) : undefined,
        request,
      });
      if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: 400 });
      const view = await buildSupervisorContactAccessView(applicationId);
      return NextResponse.json({ ok: true, ...view });
    }

    const result = await grantOrUpdateContactAccess({
      applicationId,
      actor,
      flags: {
        shareStudentPhone: body.shareStudentPhone === true,
        shareParentPhone: body.shareParentPhone === true,
        shareStudentEmail: body.shareStudentEmail === true,
        shareInstitutionContact: body.shareInstitutionContact === true,
      },
      notes: body.notes ? String(body.notes) : undefined,
      request,
    });

    if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: 400 });

    const view = await buildSupervisorContactAccessView(applicationId);
    return NextResponse.json({ ok: true, access: result.access, ...view });
  } catch (error) {
    console.error("[POST /api/admin/partnerships/applications/[id]/contact-access]", error);
    return jsonInternalServerError(error);
  }
}
