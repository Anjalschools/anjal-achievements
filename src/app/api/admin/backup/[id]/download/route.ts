import { NextRequest, NextResponse } from "next/server";
import { requireSystemAdmin } from "@/lib/backup/backup-auth";
import { getBackupRecordById, loadBackupZipByRecordId, readCachedLocalBackupZip } from "@/lib/backup/backup-service";

type Params = { params: { id: string } };

export const runtime = "nodejs";

export async function GET(_request: NextRequest, { params }: Params) {
  const gate = await requireSystemAdmin();
  if (!gate.ok) return gate.response;

  const row = await getBackupRecordById(params.id);
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const cached = row.storageProvider === "local" ? readCachedLocalBackupZip(params.id) : null;
    const zipBuffer = cached || (await loadBackupZipByRecordId(params.id));
    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${row.fileName}"`,
        "Content-Length": String(zipBuffer.byteLength),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "DOWNLOAD_FAILED";
    if (message === "BACKUP_FILE_NOT_AVAILABLE") {
      return NextResponse.json(
        {
          error:
            "الملف غير متاح للتنزيل من السجل. استخدم التخزين السحابي (R2) أو أنشئ نسخة جديدة للتنزيل المباشر.",
        },
        { status: 410 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
