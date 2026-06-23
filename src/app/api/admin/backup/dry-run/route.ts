import { NextRequest, NextResponse } from "next/server";
import { requireSystemAdmin } from "@/lib/backup/backup-auth";
import { dryRunRestoreBackup } from "@/lib/backup/restore-service";
import { auditActorFromUser, logBackupAuditEvent } from "@/lib/backup/backup-audit";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const gate = await requireSystemAdmin(request);
  if (!gate.ok) return gate.response;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "FILE_REQUIRED" }, { status: 400 });
    }
    const zipBuffer = Buffer.from(await file.arrayBuffer());
    const report = await dryRunRestoreBackup(zipBuffer);

    await logBackupAuditEvent({
      request,
      actor: auditActorFromUser(gate.user),
      actionType: "backup_dry_run",
      metadata: {
        status: report.status,
        counts: report.counts,
      },
      outcome: report.status === "PASS" ? "success" : "failure",
      descriptionAr: "فحص استعادة نسخة احتياطية (تجريبي)",
    });

    return NextResponse.json({ ok: true, data: report });
  } catch (error) {
    const message = error instanceof Error ? error.message : "DRY_RUN_FAILED";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
