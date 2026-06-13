import { NextRequest, NextResponse } from "next/server";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import {
  isValidBulkAction,
  runBulkApplicationOperation,
} from "@/lib/partnerships/partnerships-bulk-operations";
import { requirePartnershipsApprove } from "@/lib/partnerships/partnerships-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  const gate = await requirePartnershipsApprove();
  if (!gate.ok) return gate.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action || "").trim();
    const applicationIds = Array.isArray(body.applicationIds)
      ? body.applicationIds.map((id) => String(id))
      : [];
    const note = String(body.note || "").trim();
    const rejectionReason = String(body.rejectionReason || "").trim();

    if (!isValidBulkAction(action)) {
      return NextResponse.json({ error: "Invalid bulk action" }, { status: 400 });
    }
    if (!applicationIds.length) {
      return NextResponse.json({ error: "applicationIds is required" }, { status: 400 });
    }

    const result = await runBulkApplicationOperation({
      applicationIds,
      action,
      note: note || undefined,
      rejectionReason: rejectionReason || undefined,
      actor: gate.user,
      request,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[POST /api/admin/partnerships/applications/bulk]", error);
    return jsonInternalServerError(error);
  }
}
