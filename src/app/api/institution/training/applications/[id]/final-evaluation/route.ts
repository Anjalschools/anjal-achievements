import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import connectDB from "@/lib/mongodb";
import TrainingCompletionRecord from "@/models/TrainingCompletionRecord";
import { mergeSupervisorDefaults } from "@/lib/partnerships/institution-final-report-auto-populate";
import { resolveInstitutionOrganizationForUser } from "@/lib/partnerships/institution-portal-service";
import {
  generateInstitutionFinalReportTemplate,
  getInstitutionFinalEvaluation,
  submitInstitutionFinalEvaluation,
} from "@/lib/partnerships/training-final-institution-evaluation-service";
import { resolveFinalEvaluationContext } from "@/lib/partnerships/training-final-evaluation-access";
import {
  computeOpportunityRequiredTrainingHours,
  getTrainingHoursMaxAllowed,
} from "@/lib/partnerships/training-final-evaluation-ui-constants";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { params: { id: string } };

const resolveOrg = async (userId: string) => {
  const org = await resolveInstitutionOrganizationForUser(userId);
  if (!org?.id) return null;
  return org.id;
};

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { requireSession } = await import("@/lib/auth-guard");
    const gate = await requireSession();
    if (!gate.ok) return gate.response;

    const applicationId = String(params.id || "").trim();
    const organizationId = await resolveOrg(String(gate.user._id));
    if (!organizationId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const evaluation = await getInstitutionFinalEvaluation(applicationId, organizationId);
    const ctx = await resolveFinalEvaluationContext(applicationId);
    const requiredHours = ctx
      ? computeOpportunityRequiredTrainingHours(ctx.opportunity?.trainingStart, ctx.opportunity?.trainingEnd)
      : 0;

    let supervisorDefaults: { supervisorName: string; supervisorPhone: string } | null = null;
    if (ctx) {
      await connectDB();
      const completionRecord = await TrainingCompletionRecord.findOne({
        applicationId: ctx.application._id,
      })
        .select("supervisorName supervisorPhone")
        .lean();
      supervisorDefaults = mergeSupervisorDefaults({
        organizationContactName: ctx.organization?.contactName,
        organizationContactPhone: ctx.organization?.contactPhone,
        completionSupervisorName: completionRecord?.supervisorName,
        completionSupervisorPhone: completionRecord?.supervisorPhone,
      });
    }

    return NextResponse.json({
      ok: true,
      evaluation,
      context: {
        ...(requiredHours
          ? {
              opportunityRequiredHours: requiredHours,
              opportunityMaxAllowedHours: getTrainingHoursMaxAllowed(requiredHours),
            }
          : {}),
        supervisorDefaults,
      },
    });
  } catch (error) {
    console.error("[GET institution final-evaluation]", error);
    return jsonInternalServerError(error);
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { requireSession } = await import("@/lib/auth-guard");
    const gate = await requireSession();
    if (!gate.ok) return gate.response;

    const applicationId = String(params.id || "").trim();
    if (!mongoose.Types.ObjectId.isValid(applicationId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const organizationId = await resolveOrg(String(gate.user._id));
    if (!organizationId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = (await request.json()) as Record<string, unknown>;
    const evaluationMode = String(body.evaluationMode || "portal").trim() as "portal" | "uploaded_document";
    const actorName = String(gate.user.fullNameAr || gate.user.fullName || gate.user.email || "").trim();

    const result = await submitInstitutionFinalEvaluation({
      applicationId,
      organizationId,
      evaluationMode,
      payload: body,
      actor: { id: String(gate.user._id), name: actorName },
      request,
    });

    if (!result.ok) {
      const status = result.code === "locked" ? 409 : 400;
      return NextResponse.json({ error: result.error, code: result.code }, { status });
    }

    const evaluation = await getInstitutionFinalEvaluation(applicationId, organizationId);
    return NextResponse.json({ ok: true, id: result.id, evaluation });
  } catch (error) {
    console.error("[POST institution final-evaluation]", error);
    return jsonInternalServerError(error);
  }
}
