import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { reviewApplicationRequirement } from "@/lib/partnerships/institution-experience-service";
import {
  mapRequirementToParentConsentDisplay,
  PARENT_CONSENT_REQUIREMENT_TYPE,
} from "@/lib/partnerships/parent-consent-constants";
import {
  createParentConsentRequirement,
  getParentConsentRequirement,
  resolveOrganizationIdForApplication,
} from "@/lib/partnerships/parent-consent-service";
import {
  regenerateParentConsentTemplate,
  resolveParentConsentTemplateStaleStatus,
  resolveParentConsentUploadedAttachment,
} from "@/lib/partnerships/parent-consent-template-service";
import type { ParentConsentGeneratedTemplate } from "@/lib/partnerships/parent-consent-template-constants";
import { requirePartnershipsApprove, requirePartnershipsView } from "@/lib/partnerships/partnerships-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: { id: string } };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const gate = await requirePartnershipsView();
  if (!gate.ok) return gate.response;

  const applicationId = String(params.id || "").trim();
  if (!mongoose.Types.ObjectId.isValid(applicationId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const row = await getParentConsentRequirement(applicationId);
    const uploadedAttachment = row ? await resolveParentConsentUploadedAttachment(String(row._id)) : null;
    const generatedTemplate = row?.generatedTemplate as ParentConsentGeneratedTemplate | undefined;
    const templateStaleStatus = row
      ? await resolveParentConsentTemplateStaleStatus({
          applicationId,
          generatedTemplate: generatedTemplate || null,
        })
      : null;
    const requirement = row
      ? {
          id: String(row._id),
          requirementType: PARENT_CONSENT_REQUIREMENT_TYPE,
          title: row.title,
          description: row.description || "",
          status: row.status,
          submittedAt: row.submittedAt ? new Date(row.submittedAt).toISOString() : null,
          attachmentId: row.attachmentId ? String(row.attachmentId) : null,
          generatedTemplate: generatedTemplate || null,
          uploadedAttachment: uploadedAttachment
            ? {
                id: String(uploadedAttachment._id),
                fileName: uploadedAttachment.fileName,
                storageKey: uploadedAttachment.storageKey,
                mimeType: uploadedAttachment.mimeType || null,
              }
            : null,
          aiVerification: row.aiVerification || null,
        }
      : null;
    return NextResponse.json({
      ok: true,
      requirement,
      displayStatus: mapRequirementToParentConsentDisplay(row),
      templateStaleForOpportunity: templateStaleStatus?.isStale ?? false,
      templateVersion: generatedTemplate?.templateVersion ?? null,
    });
  } catch (error) {
    console.error("[GET /api/admin/partnerships/applications/[id]/parent-consent]", error);
    return jsonInternalServerError(error);
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const gate = await requirePartnershipsApprove();
  if (!gate.ok) return gate.response;

  const applicationId = String(params.id || "").trim();
  if (!mongoose.Types.ObjectId.isValid(applicationId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = (await request.json()) as Record<string, unknown>;
  const action = String(body.action || "create").trim();
  const actorName = String(gate.user.fullNameAr || gate.user.fullName || gate.user.email || "").trim();
  const actor = { id: String(gate.user._id), name: actorName, role: "partnershipSupervisor" };

  try {
    const organizationId = await resolveOrganizationIdForApplication(applicationId);
    if (!organizationId) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    if (action === "create") {
      const result = await createParentConsentRequirement({
        applicationId,
        organizationId,
        actor,
        request,
      });
      return NextResponse.json({ ok: true, id: result.id, alreadyExists: result.alreadyExists });
    }

    if (action === "regenerate_template") {
      const requirement = await getParentConsentRequirement(applicationId);
      if (!requirement) {
        return NextResponse.json({ error: "Parent consent requirement not found" }, { status: 404 });
      }
      const application = await import("@/models/StudentTrainingApplication").then((m) =>
        m.default.findById(applicationId).select("studentId").lean()
      );
      const regenerated = await regenerateParentConsentTemplate({
        requirementId: String(requirement._id),
        applicationId,
        studentId: String(application?.studentId || actor.id),
        actor,
        request,
      });
      if (!regenerated) {
        return NextResponse.json({ error: "Could not regenerate template" }, { status: 500 });
      }
      return NextResponse.json({
        ok: true,
        templateVersion: regenerated.templateVersion,
        fileName: regenerated.fileName,
      });
    }

    if (action === "review") {
      const requirementId = String(body.requirementId || "").trim();
      const decision = String(body.decision || "").trim() as "approve" | "reject" | "request_reupload";
      if (!requirementId || !["approve", "reject", "request_reupload"].includes(decision)) {
        return NextResponse.json({ error: "Invalid review payload" }, { status: 400 });
      }
      const result = await reviewApplicationRequirement({
        requirementId,
        organizationId,
        decision,
        actor: { id: actor.id, name: actor.name },
        note: String(body.note || ""),
        request,
      });
      if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: 400 });
      return NextResponse.json({ ok: true, status: result.status });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[POST /api/admin/partnerships/applications/[id]/parent-consent]", error);
    return jsonInternalServerError(error);
  }
}
