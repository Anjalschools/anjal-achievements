import { NextRequest, NextResponse } from "next/server";
import { requireSystemAdmin } from "@/lib/backup/backup-auth";
import {
  logBackupDownloadFailed,
  logBackupDownloadHeadersSent,
  logBackupDownloadStarted,
  logBackupDownloadStreamCreated,
} from "@/lib/backup/backup-download-diagnostics";
import {
  createBackupDownloadDiagnosticContext,
  createMonitoredBackupDownloadNodeStream,
  pipeBackupNodeReadableToWebStream,
} from "@/lib/backup/backup-download-stream";
import { getBackupRecordById, loadBackupZipStreamByRecordId } from "@/lib/backup/backup-service";

type Params = { params: { id: string } };

export const runtime = "nodejs";

const buildDownloadHeaders = (input: {
  fileName: string;
  contentLength?: number;
}): HeadersInit => {
  const headers: Record<string, string> = {
    "Content-Type": "application/zip",
    "Content-Disposition": `attachment; filename="${input.fileName}"`,
    "Cache-Control": "private, no-store",
  };

  if (input.contentLength !== undefined && input.contentLength > 0) {
    headers["Content-Length"] = String(input.contentLength);
  }

  return headers;
};

export async function GET(request: NextRequest, { params }: Params) {
  const gate = await requireSystemAdmin();
  if (!gate.ok) return gate.response;

  const row = await getBackupRecordById(params.id);
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const diagnosticContext = createBackupDownloadDiagnosticContext({
    recordId: params.id,
    storageKey: row.storageKey,
    provider: row.storageProvider,
  });

  logBackupDownloadStarted(diagnosticContext, {
    fileName: row.fileName,
    sizeBytes: row.sizeBytes,
  });

  try {
    const zipStream = await loadBackupZipStreamByRecordId(params.id, request.signal);
    const monitoredStream = createMonitoredBackupDownloadNodeStream({
      stream: zipStream.stream,
      context: diagnosticContext,
      label: `backup-download:${params.id}`,
      totalBytes: zipStream.contentLength,
    });

    logBackupDownloadStreamCreated(diagnosticContext, {
      fileName: zipStream.fileName,
      contentLength: zipStream.contentLength,
      etag: zipStream.etag,
    });

    const webStream = pipeBackupNodeReadableToWebStream({
      stream: monitoredStream,
      context: diagnosticContext,
      abortSignal: request.signal,
    });

    const headers = buildDownloadHeaders({
      fileName: zipStream.fileName,
      contentLength: zipStream.contentLength,
    });

    logBackupDownloadHeadersSent(diagnosticContext, {
      fileName: zipStream.fileName,
      contentLength: zipStream.contentLength,
    });

    return new NextResponse(webStream, {
      status: 200,
      headers,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "DOWNLOAD_FAILED";
    logBackupDownloadFailed(diagnosticContext, error);

    if (message === "BACKUP_FILE_NOT_AVAILABLE") {
      return NextResponse.json(
        {
          error:
            "الملف غير متاح للتنزيل من السجل. استخدم التخزين السحابي (R2) أو أنشئ نسخة جديدة للتنزيل المباشر.",
        },
        { status: 410 }
      );
    }

    if (message === "BACKUP_NOT_FOUND") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
