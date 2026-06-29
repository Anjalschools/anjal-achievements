import { NextRequest, NextResponse } from "next/server";
import { Readable } from "stream";

import { authorizePortfolioEvidenceAccess } from "@/lib/portfolio/portfolio-evidence-access";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const sanitizeFileName = (name: string): string =>
  name.replace(/[^\w.\-() \u0600-\u06FF]+/g, "_").slice(0, 120) || "evidence";

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug")?.trim() || "";
  const token = request.nextUrl.searchParams.get("token")?.trim() || "";
  const ref = request.nextUrl.searchParams.get("ref")?.trim() || "";
  const dispositionParam = request.nextUrl.searchParams.get("disposition")?.trim().toLowerCase();
  const disposition = dispositionParam === "attachment" ? "attachment" : "inline";

  if (!slug || !token || !ref) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const access = await authorizePortfolioEvidenceAccess({ slug, token, ref });
    if (!access.ok) {
      const status = access.error === "forbidden" ? 403 : 404;
      return NextResponse.json({ error: access.error }, { status });
    }

    const fileName = sanitizeFileName(access.fileName);
    const headers: Record<string, string> = {
      "Content-Type": access.contentType,
      "Content-Disposition": `${disposition}; filename="${encodeURIComponent(fileName)}"`,
      "Cache-Control": "private, no-store, max-age=0",
    };
    if (access.contentLength !== undefined && access.contentLength > 0) {
      headers["Content-Length"] = String(access.contentLength);
    }

    const abort = request.signal;
    if (abort.aborted) {
      access.stream.destroy();
      return NextResponse.json({ error: "aborted" }, { status: 499 });
    }
    abort.addEventListener(
      "abort",
      () => {
        if (!access.stream.destroyed) access.stream.destroy();
      },
      { once: true }
    );

    const webStream = Readable.toWeb(access.stream) as ReadableStream<Uint8Array>;
    return new NextResponse(webStream, { status: 200, headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "DOWNLOAD_FAILED";
    console.error("[portfolio-evidence]", message);
    return NextResponse.json({ error: "DOWNLOAD_FAILED" }, { status: 500 });
  }
}
