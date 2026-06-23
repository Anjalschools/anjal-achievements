import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import AuditLog from "@/models/AuditLog";
import { requireSystemAdmin } from "@/lib/backup/backup-auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const gate = await requireSystemAdmin(request);
  if (!gate.ok) return gate.response;

  await connectDB();
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") || 50), 200);
  const rows = await AuditLog.find({
    actionType: {
      $in: [
        "backup_restore",
        "backup_created",
        "backup_validated",
        "backup_dry_run",
        "dr_backup_created",
        "dr_backup_validated",
        "dr_recovery_simulation",
        "dr_scheduled_backup",
        "dr_object_export",
        "dr_restore",
      ],
    },
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return NextResponse.json({
    ok: true,
    data: rows.map((row) => ({
      id: String(row._id),
      actionType: row.actionType,
      actorName: row.actorName,
      actorEmail: row.actorEmail,
      outcome: row.outcome,
      metadata: row.metadata,
      descriptionAr: row.descriptionAr,
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    })),
  });
}
