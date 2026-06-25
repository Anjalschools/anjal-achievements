import { NextRequest, NextResponse } from "next/server";
import { requireSystemAdmin } from "@/lib/backup/backup-auth";
import { createBackup, listBackupRecords } from "@/lib/backup/backup-service";
import { auditActorFromUser, logBackupAuditEvent } from "@/lib/backup/backup-audit";
import type { BackupModuleId, BackupStorageProviderId } from "@/lib/backup/backup-constants";
import { runDrApiRoute } from "@/lib/disaster-recovery/dr-api-route-diagnostics";

export const runtime = "nodejs";

const isBackupModule = (value: string): value is BackupModuleId =>
  [
    "full",
    "users",
    "achievements",
    "school-years",
    "training",
    "settings",
    "alumni",
    "audit-logs",
    "notifications",
  ].includes(value);

const isStorageProvider = (value: string): value is BackupStorageProviderId =>
  value === "local" || value === "r2";

export async function GET() {
  return runDrApiRoute({ route: "/api/admin/backup", method: "GET" }, async () => {
    const gate = await requireSystemAdmin();
    if (!gate.ok) return gate.response;

    const rows = await listBackupRecords(100);
    return NextResponse.json({ ok: true, data: rows });
  });
}

export async function POST(request: NextRequest) {
  return runDrApiRoute({ route: "/api/admin/backup", method: "POST" }, async () => {
    const gate = await requireSystemAdmin(request);
    if (!gate.ok) return gate.response;

    let body: { module?: string; storage?: string };
    try {
      body = (await request.json()) as { module?: string; storage?: string };
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const moduleId = String(body.module || "full");
    const storageProvider = String(body.storage || "local");

    if (!isBackupModule(moduleId)) {
      return NextResponse.json({ error: "Invalid backup module" }, { status: 400 });
    }
    if (!isStorageProvider(storageProvider)) {
      return NextResponse.json({ error: "Invalid storage provider" }, { status: 400 });
    }

    try {
      const result = await createBackup({
        moduleId,
        storageProvider,
        createdByUserId: String(gate.user._id),
      });

      await logBackupAuditEvent({
        request,
        actor: auditActorFromUser(gate.user),
        actionType: "backup_created",
        entityId: result.recordId,
        metadata: {
          moduleId,
          storageProvider,
          sizeBytes: result.sizeBytes,
          recordCounts: result.recordCounts,
        },
      });

      return NextResponse.json({
        ok: true,
        data: {
          recordId: result.recordId,
          fileName: result.fileName,
          sizeBytes: result.sizeBytes,
          manifestVersion: result.manifestVersion,
          recordCounts: result.recordCounts,
          storageProvider: result.storageProvider,
          downloadUrl: `/api/admin/backup/${result.recordId}/download`,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "BACKUP_FAILED";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
