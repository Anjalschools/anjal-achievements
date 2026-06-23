import { NextRequest, NextResponse } from "next/server";
import { requireSystemAdmin } from "@/lib/backup/backup-auth";
import { createDisasterRecoveryBackup } from "@/lib/disaster-recovery/dr-backup-service";
import { auditActorFromUser, logBackupAuditEvent } from "@/lib/backup/backup-audit";
import type { BackupModuleId, BackupStorageProviderId } from "@/lib/backup/backup-constants";
import type { RetentionTier } from "@/lib/disaster-recovery/retention-policy";

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

const isRetentionTier = (value: string): value is RetentionTier =>
  value === "daily" || value === "weekly" || value === "monthly";

export async function POST(request: NextRequest) {
  const gate = await requireSystemAdmin(request);
  if (!gate.ok) return gate.response;

  let body: {
    module?: string;
    storage?: string;
    includeObjects?: boolean;
    retentionTier?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const moduleId = String(body.module || "full");
  const storageProvider = String(body.storage || "r2");
  if (!isBackupModule(moduleId)) {
    return NextResponse.json({ error: "Invalid backup module" }, { status: 400 });
  }
  if (!isStorageProvider(storageProvider)) {
    return NextResponse.json({ error: "Invalid storage provider" }, { status: 400 });
  }

  const retentionTier = body.retentionTier ? String(body.retentionTier) : "daily";
  if (!isRetentionTier(retentionTier)) {
    return NextResponse.json({ error: "Invalid retention tier" }, { status: 400 });
  }

  try {
    const result = await createDisasterRecoveryBackup({
      moduleId,
      storageProvider,
      createdByUserId: String(gate.user._id),
      includeObjects: body.includeObjects !== false,
      retentionTier,
    });

    await logBackupAuditEvent({
      request,
      actor: auditActorFromUser(gate.user),
      actionType: "dr_backup_created",
      entityId: result.recordId,
      metadata: {
        moduleId,
        storageProvider,
        objectCount: result.objectCount,
        recoveryReadinessScore: result.recoveryReadinessScore,
        retentionTier,
      },
      descriptionAr: "إنشاء نسخة كوارث كاملة (قاعدة بيانات + تخزين كائنات)",
    });

    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "DR_BACKUP_FAILED";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
