import { NextRequest, NextResponse } from "next/server";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import {
  addInstitutionCandidateTag,
  listInstitutionCandidateTags,
  removeInstitutionCandidateTag,
} from "@/lib/partnerships/institution-candidate-pipeline-service";
import { requireTrainingInstitution } from "@/lib/partnerships/partnerships-institution-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: { id: string } };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const gate = await requireTrainingInstitution();
  if (!gate.ok) return gate.response;

  const organizationId = gate.organization?.id;
  if (!organizationId) {
    return NextResponse.json({ error: "Institution organization not linked" }, { status: 403 });
  }

  try {
    const result = await listInstitutionCandidateTags(String(params.id), organizationId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true, items: result.items });
  } catch (error) {
    console.error("[GET /api/institution/training/applications/[id]/tags]", error);
    return jsonInternalServerError(error);
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const gate = await requireTrainingInstitution();
  if (!gate.ok) return gate.response;

  const organizationId = gate.organization?.id;
  if (!organizationId) {
    return NextResponse.json({ error: "Institution organization not linked" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const actorName = String(
      gate.user.fullNameAr || gate.user.fullName || gate.organization?.name || gate.user.email || ""
    ).trim();

    const result = await addInstitutionCandidateTag({
      applicationId: String(params.id),
      organizationId,
      tag: String(body.tag || ""),
      authorId: String(gate.user._id),
      authorName: actorName,
      request,
    });

    if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: 400 });
    return NextResponse.json({ ok: true, id: result.id });
  } catch (error) {
    console.error("[POST /api/institution/training/applications/[id]/tags]", error);
    return jsonInternalServerError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const gate = await requireTrainingInstitution();
  if (!gate.ok) return gate.response;

  const organizationId = gate.organization?.id;
  if (!organizationId) {
    return NextResponse.json({ error: "Institution organization not linked" }, { status: 403 });
  }

  const tagId = new URL(request.url).searchParams.get("tagId")?.trim();
  if (!tagId) return NextResponse.json({ error: "tagId is required" }, { status: 400 });

  try {
    const result = await removeInstitutionCandidateTag({
      applicationId: String(params.id),
      organizationId,
      tagId,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DELETE /api/institution/training/applications/[id]/tags]", error);
    return jsonInternalServerError(error);
  }
}
