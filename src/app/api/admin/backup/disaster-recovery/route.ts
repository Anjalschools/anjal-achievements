import { NextRequest, NextResponse } from "next/server";
import { requireSystemAdmin } from "@/lib/backup/backup-auth";
import { auditActorFromUser } from "@/lib/backup/backup-audit";
import type { BackupModuleId, BackupStorageProviderId } from "@/lib/backup/backup-constants";
import { startDisasterRecoveryBackupJob } from "@/lib/disaster-recovery/dr-backup-job";
import { registerDrProcessDiagnostics } from "@/lib/disaster-recovery/dr-process-diagnostics";
import {
  DisasterRecoveryBackupError,
  toDisasterRecoveryErrorPayload,
} from "@/lib/disaster-recovery/dr-backup-logging";
import { resolveDisasterRecoveryStorageProvider } from "@/lib/disaster-recovery/dr-storage-resolution";
import type { RetentionTier } from "@/lib/disaster-recovery/retention-policy";

registerDrProcessDiagnostics();
console.log("[DR-ROUTE] MODULE LOADED");

export const runtime = "nodejs";
export const maxDuration = 60;

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
  if (
    code === "R2_NOT_CONFIGURED" ||
    code === "CLOUDINARY_NOT_CONFIGURED" ||
    code === "DISASTER_RECOVERY_STREAMING_STORAGE_REQUIRED"
  ) {
    return 503;
  }
  if (code.endsWith("_NOT_CONFIGURED")) return 503;
  return 500;
};

export async function POST(request: NextRequest) {
  console.log("[DR-ROUTE] POST ENTER");
  console.log("[DR-API] REQUEST RECEIVED");

  const gate = await requireSystemAdmin(request);
  if (!gate.ok) {
    console.log("[DR-AUTH] DENIED", { status: gate.response.status });
    return gate.response;
  }
  console.log("[DR-AUTH] OK", { userId: String(gate.user._id) });

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

  const includeObjects = body.includeObjects !== false;
  try {
    resolveDisasterRecoveryStorageProvider({
      requested: storageProvider,
      includeObjects,
      source: "api-route",
    });
  } catch (error) {
    const payload = toDisasterRecoveryErrorPayload(error);
    const status = resolveDrErrorStatus(error);
    console.error("[DR-API] STORAGE_PROVIDER_REJECTED", payload);
    return NextResponse.json(payload, { status });
  }

  console.log("[DR-API] BEFORE SERVICE (async job enqueue)");
  const accepted = await startDisasterRecoveryBackupJob(
    {
      moduleId,
      storageProvider,
      createdByUserId: String(gate.user._id),
      includeObjects,
      retentionTier,
    },
    {
      request,
      actor: auditActorFromUser(gate.user),
    }
  );
  console.log("[DR-API] AFTER SERVICE (202 accepted)", { recordId: accepted.recordId });

  return NextResponse.json(
    {
      ok: true,
      accepted: true,
      status: accepted.status,
      data: {
        recordId: accepted.recordId,
        statusUrl: accepted.statusUrl,
        fileName: accepted.fileName,
        pollIntervalMs: 5000,
      },
    },
    { status: 202 }
  );
}
