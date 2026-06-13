import { NextRequest, NextResponse } from "next/server";
import { actorFromUser, logAuditEvent } from "@/lib/audit-log-service";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { listOpportunitiesQuotaDashboard } from "@/lib/partnerships/partnerships-quotas";
import { requirePartnershipsManage, requirePartnershipsView } from "@/lib/partnerships/partnerships-auth";
import {
  getPartnershipProgramSettings,
  updatePartnershipProgramSettings,
} from "@/lib/partnerships/partnerships-settings-service";
import { getPartnershipSlaDashboard } from "@/lib/partnerships/partnerships-sla";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const gate = await requirePartnershipsView();
  if (!gate.ok) return gate.response;

  try {
    const [settings, quotas, sla] = await Promise.all([
      getPartnershipProgramSettings(),
      listOpportunitiesQuotaDashboard(),
      getPartnershipSlaDashboard(),
    ]);
    return NextResponse.json({ ok: true, settings, quotas, sla });
  } catch (error) {
    console.error("[GET /api/admin/partnerships/settings]", error);
    return jsonInternalServerError(error);
  }
}

export async function PATCH(request: NextRequest) {
  const gate = await requirePartnershipsManage();
  if (!gate.ok) return gate.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const settings = await updatePartnershipProgramSettings(
      {
        defaultAcademicYear: body.defaultAcademicYear != null ? String(body.defaultAcademicYear) : undefined,
        maxOpportunitiesPerStudent:
          body.maxOpportunitiesPerStudent != null ? Number(body.maxOpportunitiesPerStudent) : undefined,
        allowMultipleApplications:
          typeof body.allowMultipleApplications === "boolean" ? body.allowMultipleApplications : undefined,
        showPortfolioToInstitutions:
          typeof body.showPortfolioToInstitutions === "boolean"
            ? body.showPortfolioToInstitutions
            : undefined,
        showExcellenceScoreToInstitutions:
          typeof body.showExcellenceScoreToInstitutions === "boolean"
            ? body.showExcellenceScoreToInstitutions
            : undefined,
        allowVideoUpload: typeof body.allowVideoUpload === "boolean" ? body.allowVideoUpload : undefined,
        maxAttachmentSizeMb:
          body.maxAttachmentSizeMb != null ? Number(body.maxAttachmentSizeMb) : undefined,
        reviewSlaHours: body.reviewSlaHours != null ? Number(body.reviewSlaHours) : undefined,
        institutionDecisionSlaDays:
          body.institutionDecisionSlaDays != null ? Number(body.institutionDecisionSlaDays) : undefined,
        trainingCompletionSlaDays:
          body.trainingCompletionSlaDays != null ? Number(body.trainingCompletionSlaDays) : undefined,
        backupIntegrationEnabled:
          typeof body.backupIntegrationEnabled === "boolean" ? body.backupIntegrationEnabled : undefined,
      },
      gate.user._id
    );

    await logAuditEvent({
      actionType: "partnerships_settings_updated",
      entityType: "PartnershipProgramSettings",
      entityId: "default",
      descriptionAr: "تحديث إعدادات برنامج التدريب والشراكات",
      actor: actorFromUser(gate.user),
      request,
      outcome: "success",
      metadata: { patchKeys: Object.keys(body) },
    });

    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    console.error("[PATCH /api/admin/partnerships/settings]", error);
    return jsonInternalServerError(error);
  }
}
