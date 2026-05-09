import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { requireAdminUserManager } from "@/lib/admin-user-management-auth";
import { upsertRelationshipScore } from "@/lib/alumni/crm-intelligence";
import { logAuditEvent, actorFromUser } from "@/lib/audit-log-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const gate = await requireAdminUserManager();
  if (!gate.ok) return gate.response;
  try {
    const body = (await request.json()) as { limit?: number };
    const limit = Math.min(200, Math.max(1, Number(body.limit) || 60));

    await connectDB();
    const rows = await User.find({ accountType: "alumni" })
      .select("_id")
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();

    let updated = 0;
    for (const row of rows) {
      await upsertRelationshipScore(row._id as any);
      updated += 1;
    }

    await logAuditEvent({
      actionType: "alumni.crm_recompute",
      descriptionAr: "إعادة حساب درجات علاقة الخريجين (دفعة)",
      metadata: { limit, updated },
      actor: actorFromUser(gate.user),
      outcome: "success",
    });

    return NextResponse.json({ ok: true, updated });
  } catch (error) {
    console.error("[POST /api/admin/alumni/crm/recompute]", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
