import { NextRequest, NextResponse } from "next/server";
import { actorFromUser, logAuditEvent } from "@/lib/audit-log-service";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import {
  requirePartnershipsApprove,
  requirePartnershipsView,
  requireStudentApplicant,
} from "@/lib/partnerships/partnerships-auth";
import {
  getStudentTrainingReport,
  listTrainingCompletionReports,
  saveTrainingCompletionReport,
  type TrainingAttachmentInput,
} from "@/lib/partnerships/training-completion-service";
import type { TrainingAttachmentType } from "@/lib/partnerships/training-completion-constants";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const parseAttachments = (raw: unknown): TrainingAttachmentInput[] => {
  if (!Array.isArray(raw)) return [];
  const out: TrainingAttachmentInput[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const fileName = String(o.fileName || "").trim();
    const storageKey = String(o.storageKey || o.url || o.key || "").trim();
    if (!fileName || !storageKey) continue;
    const typeRaw = String(o.type || "").trim();
    const type =
      typeRaw === "pdf" || typeRaw === "image" || typeRaw === "document"
        ? (typeRaw as TrainingAttachmentType)
        : undefined;
    out.push({
      type,
      fileName,
      storageKey,
      mimeType: String(o.mimeType || "").trim() || undefined,
    });
  }
  return out;
};

export async function GET(request: NextRequest) {
  const scope = String(request.nextUrl.searchParams.get("scope") || "").trim();

  try {
    if (scope === "student") {
      const gate = await requireStudentApplicant();
      if (!gate.ok) return gate.response;
      const payload = await getStudentTrainingReport(gate.user._id);
      return NextResponse.json({ ok: true, ...payload });
    }

    const gate = await requirePartnershipsView();
    if (!gate.ok) return gate.response;

    const status = String(request.nextUrl.searchParams.get("status") || "all").trim();
    const organizationId = String(request.nextUrl.searchParams.get("organizationId") || "").trim();
    const academicYear = String(request.nextUrl.searchParams.get("academicYear") || "").trim();

    const result = await listTrainingCompletionReports({
      status: status || undefined,
      organizationId: organizationId || undefined,
      academicYear: academicYear || undefined,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[GET /api/partnerships/final-reports]", error);
    return jsonInternalServerError(error);
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireStudentApplicant();
  if (!gate.ok) return gate.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const applicationId = String(body.applicationId || "").trim();
    if (!applicationId) {
      return NextResponse.json({ error: "applicationId is required" }, { status: 400 });
    }

    const item = await saveTrainingCompletionReport({
      applicationId,
      studentId: gate.user._id,
      submit: body.submit === true,
      supervisorName: String(body.supervisorName || "").trim() || undefined,
      supervisorPhone: String(body.supervisorPhone || "").trim() || undefined,
      trainingStartDate: String(body.trainingStartDate || "").trim() || undefined,
      trainingEndDate: String(body.trainingEndDate || "").trim() || undefined,
      volunteerHours:
        body.volunteerHours != null && Number.isFinite(Number(body.volunteerHours))
          ? Number(body.volunteerHours)
          : undefined,
      hasAllowance: typeof body.hasAllowance === "boolean" ? body.hasAllowance : undefined,
      studentBenefitRating:
        body.studentBenefitRating != null ? Number(body.studentBenefitRating) : undefined,
      numberOfTrainees:
        body.numberOfTrainees != null ? Number(body.numberOfTrainees) : undefined,
      positionTitle: String(body.positionTitle || "").trim() || undefined,
      assignedTasks: String(body.assignedTasks || "").trim() || undefined,
      studentReflection: String(body.studentReflection || "").trim() || undefined,
      supervisorCooperationRating:
        body.supervisorCooperationRating != null ? Number(body.supervisorCooperationRating) : undefined,
      practicalBenefitRating:
        body.practicalBenefitRating != null ? Number(body.practicalBenefitRating) : undefined,
      workEnvironmentRating:
        body.workEnvironmentRating != null ? Number(body.workEnvironmentRating) : undefined,
      recommendInstitutionToPeers:
        typeof body.recommendInstitutionToPeers === "boolean"
          ? body.recommendInstitutionToPeers
          : undefined,
      biggestChallenge: String(body.biggestChallenge || "").trim() || undefined,
      challengeResponse: String(body.challengeResponse || "").trim() || undefined,
      wishedToLearn: String(body.wishedToLearn || "").trim() || undefined,
      futureImpact: String(body.futureImpact || "").trim() || undefined,
      videoUrl: String(body.videoUrl || "").trim() || undefined,
      attachments: parseAttachments(body.attachments),
      institutionReport:
        body.institutionReport && typeof body.institutionReport === "object"
          ? {
              fileName: String((body.institutionReport as Record<string, unknown>).fileName || "").trim(),
              storageKey: String(
                (body.institutionReport as Record<string, unknown>).storageKey ||
                  (body.institutionReport as Record<string, unknown>).url ||
                  ""
              ).trim(),
              mimeType: String((body.institutionReport as Record<string, unknown>).mimeType || "").trim() || undefined,
            }
          : undefined,
    });

    if (body.submit === true) {
      await logAuditEvent({
        actionType: "training_report_submitted",
        entityType: "TrainingCompletionRecord",
        entityId: item?.id,
        descriptionAr: "رفع تقرير التدريب النهائي",
        actor: actorFromUser(gate.user),
        request,
        outcome: "success",
        metadata: { applicationId },
      });
    }

    if (Array.isArray(body.attachments) && body.attachments.length > 0) {
      await logAuditEvent({
        actionType: "training_attachment_uploaded",
        entityType: "TrainingCompletionRecord",
        entityId: item?.id,
        descriptionAr: "رفع مرفق تقرير تدريب",
        actor: actorFromUser(gate.user),
        request,
        outcome: "success",
        metadata: { count: body.attachments.length },
      });
    }

    return NextResponse.json({ ok: true, item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error";
    if (
      message.includes("required") ||
      message.includes("not found") ||
      message.includes("eligible") ||
      message.includes("edited") ||
      message.includes("videoUrl") ||
      message.includes("Forbidden")
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("[POST /api/partnerships/final-reports]", error);
    return jsonInternalServerError(error);
  }
}
