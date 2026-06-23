import { NextRequest, NextResponse } from "next/server";
import { requireSystemAdmin } from "@/lib/backup/backup-auth";
import { executeRestoreBackup } from "@/lib/backup/restore-service";
import { buildRestoreAuditMetadata } from "@/lib/backup/restore-audit";
import { auditActorFromUser, logRestoreAuditEvent } from "@/lib/backup/backup-audit";
import type { BackupStorageProviderId, RestoreMode } from "@/lib/backup/backup-constants";
import { extractBackupZipPackage } from "@/lib/backup/backup-package";

export const runtime = "nodejs";

const RESTORE_CONFIRM_PHRASE = "RESTORE";

const isRestoreMode = (value: string): value is RestoreMode =>
  value === "replace" || value === "merge" || value === "selective";

const isStorageProvider = (value: string): value is BackupStorageProviderId =>
  value === "local" || value === "r2";

export async function POST(request: NextRequest) {
  const gate = await requireSystemAdmin(request);
  if (!gate.ok) return gate.response;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const mode = String(formData.get("mode") || "");
    const confirmText = String(formData.get("confirmText") || "").trim();
    const confirmPhrase = String(formData.get("confirmPhrase") || "").trim();
    const collectionKeysRaw = String(formData.get("collectionKeys") || "");
    const storageProvider = String(formData.get("snapshotStorage") || "local");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "FILE_REQUIRED" }, { status: 400 });
    }
    if (!isRestoreMode(mode)) {
      return NextResponse.json({ error: "INVALID_RESTORE_MODE" }, { status: 400 });
    }

    if (mode === "replace") {
      if (confirmText !== RESTORE_CONFIRM_PHRASE || confirmPhrase !== RESTORE_CONFIRM_PHRASE) {
        return NextResponse.json(
          { error: "DOUBLE_CONFIRMATION_REQUIRED", phrase: RESTORE_CONFIRM_PHRASE },
          { status: 400 }
        );
      }
    }

    const selectiveCollectionKeys = collectionKeysRaw
      ? collectionKeysRaw
          .split(",")
          .map((key) => key.trim())
          .filter(Boolean)
      : undefined;

    if (mode === "selective" && !selectiveCollectionKeys?.length) {
      return NextResponse.json({ error: "SELECTIVE_COLLECTIONS_REQUIRED" }, { status: 400 });
    }

    const zipBuffer = Buffer.from(await file.arrayBuffer());
    const extracted = await extractBackupZipPackage(zipBuffer);
    const backupIdentifier = extracted.manifest.createdAt || `upload-${Date.now()}`;

    const result = await executeRestoreBackup({
      zipBuffer,
      mode,
      selectiveCollectionKeys,
      actorUserId: String(gate.user._id),
      createPreRestoreSnapshot: mode === "replace",
      snapshotStorageProvider: isStorageProvider(storageProvider) ? storageProvider : "local",
    });

    await logRestoreAuditEvent({
      request,
      actor: auditActorFromUser(gate.user),
      metadata: buildRestoreAuditMetadata({
        backupIdentifier,
        mode,
        collections: result.collections,
        recordCounts: result.recordCounts,
        preRestoreBackupId: result.preRestoreBackupId,
        manifest: extracted.manifest,
      }),
      outcome: "success",
    });

    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "RESTORE_FAILED";

    await logRestoreAuditEvent({
      request,
      actor: auditActorFromUser(gate.user),
      metadata: { error: message },
      outcome: "failure",
    }).catch(() => undefined);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
