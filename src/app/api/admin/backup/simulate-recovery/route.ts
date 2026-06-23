import { NextRequest, NextResponse } from "next/server";
import { requireSystemAdmin } from "@/lib/backup/backup-auth";
import { runRecoverySimulation } from "@/lib/disaster-recovery/recovery-simulation";
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
    const report = await runRecoverySimulation(zipBuffer);

    await logBackupAuditEvent({
      request,
      actor: auditActorFromUser(gate.user),
      actionType: "dr_recovery_simulation",
      metadata: {
        status: report.status,
        phases: report.phases,
        recoveryReadinessScore: report.recoveryReadinessScore,
        certifications: report.certifications,
      },
      outcome: report.status === "PASS" ? "success" : "failure",
      descriptionAr: "محاكاة استعادة الكوارث",
    });

    return NextResponse.json({ ok: true, data: report });
  } catch (error) {
    const message = error instanceof Error ? error.message : "SIMULATION_FAILED";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
