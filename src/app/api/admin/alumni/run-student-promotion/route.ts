import { NextRequest, NextResponse } from "next/server";
import { requireAdminUserManager } from "@/lib/admin-user-management-auth";
import { sanitizeMongoShape } from "@/lib/sanitize-input";
import { runStudentPromotionJob } from "@/lib/alumni/student-promotion/promotion-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;

  try {
    const body = sanitizeMongoShape((await request.json().catch(() => ({}))) as Record<string, unknown>);
    const dryRun = body.dryRun === true;

    const result = await runStudentPromotionJob({ dryRun });
    if (!result.ok) {
      return NextResponse.json({ error: result.code }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      dryRun: result.dryRun,
      examined: result.examined,
      promoted: result.promoted,
      skipped: result.skipped,
    });
  } catch (error) {
    console.error("[POST /api/admin/alumni/run-student-promotion]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
