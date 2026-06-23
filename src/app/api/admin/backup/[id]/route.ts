import { NextRequest, NextResponse } from "next/server";
import { requireSystemAdmin } from "@/lib/backup/backup-auth";
import { deleteBackupRecordMetadata, getBackupRecordById } from "@/lib/backup/backup-service";
import { auditActorFromUser, logBackupAuditEvent } from "@/lib/backup/backup-audit";

type Params = { params: { id: string } };

export const runtime = "nodejs";

export async function GET(_request: NextRequest, { params }: Params) {
  const gate = await requireSystemAdmin();
  if (!gate.ok) return gate.response;

  const row = await getBackupRecordById(params.id);
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, data: row });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const gate = await requireSystemAdmin(request);
  if (!gate.ok) return gate.response;

  const existing = await getBackupRecordById(params.id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await deleteBackupRecordMetadata(params.id);

  await logBackupAuditEvent({
    request,
    actor: auditActorFromUser(gate.user),
    actionType: "backup_metadata_deleted",
    entityId: params.id,
    metadata: {
      fileName: existing.fileName,
      storageProvider: existing.storageProvider,
      storageKey: existing.storageKey,
    },
    descriptionAr: "حذف سجل نسخة احتياطية (البيانات الوصفية فقط)",
  });

  return NextResponse.json({ ok: true });
}
