import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { loadPartnershipApplicationDetail } from "@/lib/partnerships/partnerships-application-loader";
import { isValidSupervisorAction } from "@/lib/partnerships/partnerships-application-workflow";
import { requirePartnershipsApprove, requirePartnershipsView } from "@/lib/partnerships/partnerships-auth";
import { validateApplicationTransition } from "@/lib/partnerships/partnerships-state-machine";
import {
  canSupervisorApproveApplication,
  executeSupervisorApplicationTransition,
  supervisorApprovalBlockedReason,
} from "@/lib/partnerships/partnerships-supervisor-transition-service";

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
    const item = await loadPartnershipApplicationDetail(id, {
      includeReviewContext: true,
      locale: "ar",
    });
    if (!item) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    console.error("[GET /api/admin/partnerships/applications/[id]]", error);
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
    const action = String(body.action || "").trim();
    const note = String(body.note || "").trim();
    const rejectionReason = String(body.rejectionReason || "").trim();

    if (!isValidSupervisorAction(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    if (action === "rejected" && !rejectionReason) {
      return NextResponse.json({ error: "Rejection reason is required" }, { status: 400 });
    }

    if (action === "accepted") {
      const { default: StudentTrainingApplication } = await import("@/models/StudentTrainingApplication");
      const application = await StudentTrainingApplication.findById(id).select("status").lean();
      if (!application) {
        return NextResponse.json({ error: "Application not found" }, { status: 404 });
      }
      if (!canSupervisorApproveApplication(String(application.status || ""))) {
        return NextResponse.json(
          {
            error: supervisorApprovalBlockedReason(String(application.status || ""), true),
            code: "approval_blocked",
          },
          { status: 400 }
        );
      }
    }

    const result = await executeSupervisorApplicationTransition({
      applicationId: id,
      action,
      actor: gate.user,
      note: note || undefined,
      rejectionReason: rejectionReason || undefined,
      request,
    });

    if (!result.ok) {
      const status = result.code === "seats_full" ? 409 : 400;
      return NextResponse.json({ error: result.error, code: result.code }, { status });
    }

    const item = await loadPartnershipApplicationDetail(id, {
      includeReviewContext: true,
      locale: "ar",
    });

    return NextResponse.json({ ok: true, item, steps: result.steps });
  } catch (error) {
    console.error("[PATCH /api/admin/partnerships/applications/[id]]", error);
    return jsonInternalServerError(error);
  }
}
