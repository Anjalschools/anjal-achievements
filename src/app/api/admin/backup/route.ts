import { NextRequest, NextResponse } from "next/server";
import { Readable } from "stream";
import { requireSystemAdmin } from "@/lib/backup/backup-auth";
import { createBackup, listBackupRecords, openPreparedBackupZipStream } from "@/lib/backup/backup-service";
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

const isLocalDeliveryMode = (body: {
  mode?: string;
  localOnly?: boolean;
}): boolean => body.mode === "local" || body.localOnly === true;

const sanitizeDownloadFileName = (fileName: string): string =>
  fileName.replace(/[^\w.\-() \u0600-\u06FF]+/g, "_").slice(0, 120) || "anjal-backup.zip";

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

    let body: { module?: string; storage?: string; mode?: string; localOnly?: boolean };
    try {
      body = (await request.json()) as {
        module?: string;
        storage?: string;
        mode?: string;
        localOnly?: boolean;
      };
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const moduleId = String(body.module || "full");
    const storageProvider = String(body.storage || "local");
    const localDelivery = isLocalDeliveryMode(body);

    if (!isBackupModule(moduleId)) {
      return NextResponse.json({ error: "Invalid backup module" }, { status: 400 });
    }
    if (!localDelivery && !isStorageProvider(storageProvider)) {
      return NextResponse.json({ error: "Invalid storage provider" }, { status: 400 });
    }

    try {
      const result = await createBackup({
        moduleId,
        storageProvider: (localDelivery ? "local" : storageProvider) as BackupStorageProviderId,
        createdByUserId: String(gate.user._id),
        deliveryMode: localDelivery ? "local" : "remote",
      });

      if (localDelivery) {
        if (!result.zipBuffer) {
          return NextResponse.json({ error: "BACKUP_FILE_NOT_AVAILABLE" }, { status: 500 });
        }

        await logBackupAuditEvent({
          request,
          actor: auditActorFromUser(gate.user),
          actionType: "backup_created",
          metadata: {
            moduleId,
            deliveryMode: "local",
            sizeBytes: result.sizeBytes,
            recordCounts: result.recordCounts,
            fileName: result.fileName,
          },
        });

        const fileName = sanitizeDownloadFileName(result.fileName);
        const nodeStream = openPreparedBackupZipStream(result.zipBuffer);
        const abort = request.signal;
        if (abort.aborted) {
          nodeStream.destroy();
          return NextResponse.json({ error: "aborted" }, { status: 499 });
        }
        abort.addEventListener(
          "abort",
          () => {
            if (!nodeStream.destroyed) nodeStream.destroy();
          },
          { once: true }
        );

        const headers: Record<string, string> = {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
          "Cache-Control": "private, no-store, max-age=0",
        };
        if (result.sizeBytes > 0) {
          headers["Content-Length"] = String(result.sizeBytes);
        }

        const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
        return new NextResponse(webStream, { status: 200, headers });
      }

      await logBackupAuditEvent({
        request,
        actor: auditActorFromUser(gate.user),
        actionType: "backup_created",
        entityId: result.recordId,
        metadata: {
          moduleId,
          storageProvider,
          deliveryMode: "remote",
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
