import { NextRequest, NextResponse } from "next/server";
import { requireSystemAdmin } from "@/lib/backup/backup-auth";
import { createDisasterRecoveryBackup } from "@/lib/disaster-recovery/dr-backup-service";
import { auditActorFromUser, logBackupAuditEvent } from "@/lib/backup/backup-audit";
import type { BackupModuleId, BackupStorageProviderId } from "@/lib/backup/backup-constants";
import {
  DisasterRecoveryBackupError,
  toDisasterRecoveryErrorPayload,
} from "@/lib/disaster-recovery/dr-backup-logging";
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

const resolveDrErrorStatus = (error: unknown): number => {
  if (!(error instanceof DisasterRecoveryBackupError)) return 500;
  const code = error.message;
  if (code === "R2_NOT_CONFIGURED" || code === "CLOUDINARY_NOT_CONFIGURED") return 503;
  if (code.endsWith("_NOT_CONFIGURED")) return 503;
  return 500;
};

export async function POST(request: NextRequest) {
  console.log("[DR-API] REQUEST RECEIVED");
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
    console.log("[DR-API] BEFORE SERVICE");
    const result = await createDisasterRecoveryBackup({
      moduleId,
      storageProvider,
      createdByUserId: String(gate.user._id),
      includeObjects: body.includeObjects !== false,
      retentionTier,
    });
    console.log("[DR-API] AFTER SERVICE");

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
    console.error("[DR-API] FAILED", error);
    const payload = toDisasterRecoveryErrorPayload(error);
    const status = resolveDrErrorStatus(error);

    await logBackupAuditEvent({
      request,
      actor: auditActorFromUser(gate.user),
      actionType: "dr_backup_failed",
      metadata: {
        moduleId,
        storageProvider,
        stage: payload.stage,
        message: payload.message,
        details: payload.details,
      },
      outcome: "failure",
      descriptionAr: "فشل إنشاء نسخة كوارث كاملة",
    }).catch(() => undefined);

    return NextResponse.json(payload, { status });
  }
}
