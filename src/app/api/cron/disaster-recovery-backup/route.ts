import { NextRequest, NextResponse } from "next/server";
import { startDisasterRecoveryBackupJob } from "@/lib/disaster-recovery/dr-backup-job";
import { auditActorFromUser, logBackupAuditEvent } from "@/lib/backup/backup-audit";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  const auth = request.headers.get("authorization") || "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const actorUserId = process.env.SYSTEM_ADMIN_USER_ID?.trim();
  if (!actorUserId) {
    return NextResponse.json({ error: "SYSTEM_ADMIN_USER_ID not configured" }, { status: 503 });
  }

  await connectDB();
  const systemAdmin = await User.findById(actorUserId);
  if (!systemAdmin) {
    return NextResponse.json({ error: "SYSTEM_ADMIN_USER_ID invalid" }, { status: 503 });
  }
  const actor = auditActorFromUser(systemAdmin);

  try {
    const accepted = await startDisasterRecoveryBackupJob(
      {
        moduleId: "full",
        storageProvider: "r2",
        createdByUserId: actorUserId,
        includeObjects: true,
        retentionTier: "daily",
        note: "scheduled-dr-backup",
      },
      { request, actor },
      { source: "cron", pruneExpiredOnComplete: true }
    );

    await logBackupAuditEvent({
      actor,
      actionType: "dr_scheduled_backup_enqueued",
      entityId: accepted.recordId,
      metadata: {
        recordId: accepted.recordId,
        statusUrl: accepted.statusUrl,
      },
      descriptionAr: "إدراج نسخة كوارث مجدولة في طابور العامل",
    });

    return NextResponse.json(
      {
        ok: true,
        accepted: true,
        backupId: accepted.recordId,
        statusUrl: accepted.statusUrl,
      },
      { status: 202 }
    );
  } catch (error) {
    console.error("[cron/disaster-recovery-backup]", error);
    await logBackupAuditEvent({
      actor,
      actionType: "dr_scheduled_backup_failed",
      metadata: { error: error instanceof Error ? error.message : "FAILED" },
      outcome: "failure",
    }).catch(() => undefined);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
