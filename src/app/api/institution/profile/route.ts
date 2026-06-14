import { NextRequest, NextResponse } from "next/server";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import {
  buildInstitutionPortalProfile,
  updateInstitutionNotificationSettings,
} from "@/lib/partnerships/institution-portal-profile-service";
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
    const profile = await buildInstitutionPortalProfile(organizationId);
    if (!profile) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, ...profile });
  } catch (error) {
    console.error("[GET /api/institution/profile]", error);
    return jsonInternalServerError(error);
  }
}

export async function PATCH(request: NextRequest) {
  const gate = await requireTrainingInstitution();
  if (!gate.ok) return gate.response;

  const organizationId = gate.organization?.id;
  if (!organizationId) {
    return NextResponse.json({ error: "Institution organization not linked" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const settings = {
      newStudents: body.newStudents !== undefined ? Boolean(body.newStudents) : undefined,
      interviews: body.interviews !== undefined ? Boolean(body.interviews) : undefined,
      documents: body.documents !== undefined ? Boolean(body.documents) : undefined,
      messages: body.messages !== undefined ? Boolean(body.messages) : undefined,
      decisions: body.decisions !== undefined ? Boolean(body.decisions) : undefined,
      finalReports: body.finalReports !== undefined ? Boolean(body.finalReports) : undefined,
    };

    const result = await updateInstitutionNotificationSettings(organizationId, settings);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 });
    return NextResponse.json({ ok: true, notificationSettings: result.settings });
  } catch (error) {
    console.error("[PATCH /api/institution/profile]", error);
    return jsonInternalServerError(error);
  }
}
