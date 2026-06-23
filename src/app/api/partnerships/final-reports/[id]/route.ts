import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { actorFromUser, logAuditEvent } from "@/lib/audit-log-service";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { requirePartnershipsApprove, requirePartnershipsView } from "@/lib/partnerships/partnerships-auth";
import {
  TRAINING_REPORT_SUPERVISOR_ACTIONS,
  type TrainingReportSupervisorAction,
} from "@/lib/partnerships/training-completion-constants";
import {
  enrichTrainingCompletionRecordForRead,
  getAllowedCompletionTransitions,
  getTrainingCompletionReportById,
  markInstitutionReportDetectionFeedback,
  markInstitutionReportManualVerification,
  reviewTrainingCompletionReport,
} from "@/lib/partnerships/training-completion-service";
import { buildTrainingReportIntelligenceForRecord } from "@/lib/partnerships/training-intelligence-service";

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
    const item = await getTrainingCompletionReportById(id);
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const trainingIntelligence = await buildTrainingReportIntelligenceForRecord({
      ...item,
      organizationId: item.organizationId,
      institutionReportExtraction:
        item.institutionReportExtraction && typeof item.institutionReportExtraction === "object"
          ? (item.institutionReportExtraction as Record<string, unknown>)
          : null,
      institutionUploadedEvaluation:
        item.institutionUploadedEvaluation && typeof item.institutionUploadedEvaluation === "object"
          ? (item.institutionUploadedEvaluation as Record<string, unknown>)
          : null,
    });
    const enriched = enrichTrainingCompletionRecordForRead({ ...item, trainingIntelligence });
    return NextResponse.json({ ok: true, item: enriched });
  } catch (error) {
    console.error("[GET /api/partnerships/final-reports/[id]]", error);
    return jsonInternalServerError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const gate = await requirePartnershipsApprove();
  if (!gate.ok) return gate.response;

  const id = String(params.id || "").trim();
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;

    if (body.manualInstitutionVerification === true) {
      const item = await markInstitutionReportManualVerification({
        recordId: id,
        reviewerId: gate.user._id,
      });
      await logAuditEvent({
        actionType: "training_report_manual_institution_verification",
        entityType: "TrainingCompletionRecord",
        entityId: id,
        descriptionAr: "تحقق يدوي من تقرير المؤسسة",
        actor: actorFromUser(gate.user),
        request,
        outcome: "success",
      });
      return NextResponse.json({ ok: true, item });
    }

    const feedbackTarget = String(body.institutionDetectionFeedbackTarget || "").trim();
    if (feedbackTarget === "stamp" || feedbackTarget === "signature" || feedbackTarget === "rating") {
      const item = await markInstitutionReportDetectionFeedback({
        recordId: id,
        reviewerId: gate.user._id,
        target: feedbackTarget,
        ratingKey: String(body.ratingKey || "").trim() || undefined,
      });
      await logAuditEvent({
        actionType: "training_report_institution_detection_feedback",
        entityType: "TrainingCompletionRecord",
        entityId: id,
        descriptionAr: "تعليق مشرف على اكتشاف تقرير المؤسسة",
        actor: actorFromUser(gate.user),
        request,
        outcome: "success",
        metadata: { target: feedbackTarget, ratingKey: body.ratingKey ?? null },
      });
      return NextResponse.json({ ok: true, item });
    }

    const action = String(body.action || "").trim() as TrainingReportSupervisorAction;
    const note = String(body.note || "").trim();
    const approveOverride = body.approveOverride === true;

    if (!TRAINING_REPORT_SUPERVISOR_ACTIONS.includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const currentRecord = await getTrainingCompletionReportById(id);
    const currentStatus = String(currentRecord?.status || "");
    const requestedStatus =
      action === "approve"
        ? "approved"
        : action === "reject"
          ? "rejected"
          : "needs_revision";

    console.info("[PATCH /api/partnerships/final-reports/[id]]", {
      recordId: id,
      currentStatus,
      requestedStatus,
      allowedTransitions: getAllowedCompletionTransitions(currentStatus),
      reviewAction: action,
      userId: String(gate.user._id),
      approveOverride,
    });

    const actorName = String(gate.user.fullNameAr || gate.user.fullName || gate.user.email || "").trim();
    const item = await reviewTrainingCompletionReport({
      recordId: id,
      action,
      reviewerId: gate.user._id,
      actorName,
      note: note || undefined,
      approveOverride,
    });

    const auditType =
      action === "approve"
        ? "training_report_approved"
        : action === "reject"
          ? "training_report_rejected"
          : "training_report_changes_requested";

    await logAuditEvent({
      actionType: auditType,
      entityType: "TrainingCompletionRecord",
      entityId: id,
      descriptionAr:
        action === "approve"
          ? "اعتماد تقرير التدريب"
          : action === "reject"
            ? "رفض تقرير التدريب"
            : "طلب تعديل تقرير التدريب",
      actor: actorFromUser(gate.user),
      request,
      outcome: "success",
      metadata: { action, note: note || null },
    });

    const automation = (item as { automation?: Record<string, unknown> } | null)?.automation;
    if (action === "approve" && automation && automation.skipped !== true) {
      await logAuditEvent({
        actionType: "training_achievement_created",
        entityType: "Achievement",
        entityId: String(automation.achievementId || ""),
        descriptionAr: "إنشاء إنجاز تدريب صيفي تلقائياً",
        actor: actorFromUser(gate.user),
        request,
        outcome: "success",
        metadata: automation,
      });
      if (automation.certificateIssued === true) {
        await logAuditEvent({
          actionType: "training_certificate_created",
          entityType: "Achievement",
          entityId: String(automation.achievementId || ""),
          descriptionAr: "إصدار شهادة تدريب صيفي تلقائياً",
          actor: actorFromUser(gate.user),
          request,
          outcome: "success",
          metadata: automation,
        });
      }
    }

    return NextResponse.json({ ok: true, item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error";
    if (
      message.includes("required") ||
      message.includes("not found") ||
      message.includes("awaiting") ||
      message.includes("Invalid")
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("[PATCH /api/partnerships/final-reports/[id]]", error);
    return jsonInternalServerError(error);
  }
}
