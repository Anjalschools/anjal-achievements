import { NextRequest, NextResponse } from "next/server";
import { createDisasterRecoveryBackup } from "@/lib/disaster-recovery/dr-backup-service";
import {
  initDrVerification,
  logDrHttpMilestone,
  logDrMilestone,
  printDrFinalReport,
  resetDrVerification,
  updateDrVerificationReport,
} from "@/lib/disaster-recovery/dr-verification";
import {
  initDrLeakDetection,
  printDrLeakReport,
  resetDrLeakDetection,
} from "@/lib/disaster-recovery/dr-leak-detection";
import { auditActorFromUser, logBackupAuditEvent } from "@/lib/backup/backup-audit";
import connectDB from "@/lib/mongodb";
import BackupRecord from "@/models/BackupRecord";
import User from "@/models/User";
import { isBackupExpired } from "@/lib/disaster-recovery/retention-policy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const runWithRetry = async <T>(fn: () => Promise<T>, attempts = 3): Promise<T> => {
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  throw lastError;
};

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
    initDrVerification();
    initDrLeakDetection();
    const result = await runWithRetry(() =>
      createDisasterRecoveryBackup({
        moduleId: "full",
        storageProvider: "r2",
        createdByUserId: actorUserId,
        includeObjects: true,
        retentionTier: "daily",
        note: "scheduled-dr-backup",
      })
    );

    logDrMilestone("BACKUP_JOB_COMPLETED", {
      recordId: result.recordId,
      objectCount: result.objectCount,
    });

    await logBackupAuditEvent({
      actor,
      actionType: "dr_scheduled_backup",
      metadata: {
        recordId: result.recordId,
        objectCount: result.objectCount,
        recoveryReadinessScore: result.recoveryReadinessScore,
      },
      descriptionAr: "نسخة كوارث مجدولة",
    });

    await connectDB();
    const expired = await BackupRecord.find({ status: "completed" }).lean();
    const metadataDeletes = expired.filter((row) =>
      isBackupExpired({ createdAt: row.createdAt, retentionTier: row.retentionTier })
    );
    for (const row of metadataDeletes) {
      await BackupRecord.findByIdAndDelete(row._id);
    }

    logDrHttpMilestone("HTTP_RESPONSE_READY", result.recordId, { status: 200 });
    const response = NextResponse.json({
      ok: true,
      backupId: result.recordId,
      objectCount: result.objectCount,
      prunedMetadata: metadataDeletes.length,
    });
    logDrHttpMilestone("HTTP_RESPONSE_SENT", result.recordId, { status: 200 });
    updateDrVerificationReport({ responseSent: true });
    return response;
  } catch (error) {
    console.error("[cron/disaster-recovery-backup]", error);
    await logBackupAuditEvent({
      actor,
      actionType: "dr_scheduled_backup_failed",
      metadata: { error: error instanceof Error ? error.message : "FAILED" },
      outcome: "failure",
    }).catch(() => undefined);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    printDrFinalReport();
    await printDrLeakReport();
    resetDrLeakDetection();
    resetDrVerification();
  }
}
