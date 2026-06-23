import { NextRequest, NextResponse } from "next/server";
import { requireSystemAdmin } from "@/lib/backup/backup-auth";
import { extractBackupZipPackage } from "@/lib/backup/backup-zip";
import { validateDisasterRecoveryPackage } from "@/lib/disaster-recovery/dr-validation";
import { auditActorFromUser, logBackupAuditEvent } from "@/lib/backup/backup-audit";
import connectDB from "@/lib/mongodb";
import BackupRecord from "@/models/BackupRecord";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const gate = await requireSystemAdmin(request);
  if (!gate.ok) return gate.response;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const backupId = String(formData.get("backupId") || "").trim();
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "FILE_REQUIRED" }, { status: 400 });
    }

    const zipBuffer = Buffer.from(await file.arrayBuffer());
    const extracted = await extractBackupZipPackage(zipBuffer);
    const report = validateDisasterRecoveryPackage(extracted);

    if (backupId) {
      await connectDB();
      await BackupRecord.findByIdAndUpdate(backupId, {
        validationStatus: report.status === "PASS" ? "pass" : "fail",
        lastValidatedAt: new Date(),
        recoveryReadinessScore: report.recoveryReadinessScore,
      });
    }

    await logBackupAuditEvent({
      request,
      actor: auditActorFromUser(gate.user),
      actionType: "dr_backup_validated",
      entityId: backupId || undefined,
      metadata: {
        status: report.status,
        recoveryReadinessScore: report.recoveryReadinessScore,
        certifications: report.certifications,
      },
      outcome: report.status === "PASS" ? "success" : "failure",
      descriptionAr: "التحقق من نسخة الكوارث الكاملة",
    });

    return NextResponse.json({ ok: true, data: report });
  } catch (error) {
    const message = error instanceof Error ? error.message : "DR_VALIDATION_FAILED";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
