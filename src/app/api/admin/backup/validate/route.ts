import { NextRequest, NextResponse } from "next/server";
import { requireSystemAdmin } from "@/lib/backup/backup-auth";
import { extractBackupZipPackage } from "@/lib/backup/backup-package";
import { validateExtractedBackupPackage } from "@/lib/backup/restore-validation";
import { auditActorFromUser, logBackupAuditEvent } from "@/lib/backup/backup-audit";

export const runtime = "nodejs";

const readZipFromRequest = async (request: NextRequest): Promise<Buffer> => {
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new Error("FILE_REQUIRED");
  }
  const arrayBuffer = await file.arrayBuffer();
  return Buffer.from(arrayBuffer);
};

export async function POST(request: NextRequest) {
  const gate = await requireSystemAdmin(request);
  if (!gate.ok) return gate.response;

  try {
    const zipBuffer = await readZipFromRequest(request);
    const extracted = await extractBackupZipPackage(zipBuffer);
    const report = validateExtractedBackupPackage(extracted);

    await logBackupAuditEvent({
      request,
      actor: auditActorFromUser(gate.user),
      actionType: "backup_validated",
      metadata: {
        status: report.status,
        reasons: report.reasons,
        manifestVersion: report.manifest?.version,
      },
      outcome: report.status === "PASS" ? "success" : "failure",
      descriptionAr: "التحقق من نسخة احتياطية",
    });

    return NextResponse.json({ ok: true, data: report });
  } catch (error) {
    const message = error instanceof Error ? error.message : "VALIDATION_FAILED";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
