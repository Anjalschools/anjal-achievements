import { NextRequest, NextResponse } from "next/server";
import { requireAlumniAdministrationActor } from "@/lib/admin-user-management-auth";
import { parseAlumniReportFiltersFromSearchParams } from "@/lib/alumni/alumni-report-filters";
import { runAlumniReport, getAlumniReportMeta } from "@/lib/alumni/alumni-report-service";
import type { AlumniReportKind } from "@/lib/alumni/alumni-report-types";

export const dynamic = "force-dynamic";

const isKind = (v: string | null): v is AlumniReportKind =>
  v === "overview" ||
  v === "universities" ||
  v === "careers" ||
  v === "community" ||
  v === "verification" ||
  v === "reputation";

export async function GET(request: NextRequest) {
  const gate = await requireAlumniAdministrationActor();
  if (!gate.ok) return gate.response;

  try {
    const sp = request.nextUrl.searchParams;
    const metaOnly = sp.get("meta") === "1";
    if (metaOnly) {
      const meta = await getAlumniReportMeta();
      return NextResponse.json({ ok: true, meta });
    }

    const kindRaw = sp.get("kind");
    const kind: AlumniReportKind = isKind(kindRaw) ? kindRaw : "overview";
    const page = Math.min(500, Math.max(1, Number(sp.get("page")) || 1));
    const pageSize = Math.min(100, Math.max(1, Number(sp.get("pageSize")) || 25));
    const filters = parseAlumniReportFiltersFromSearchParams(sp);

    const payload = await runAlumniReport({ kind, filters, page, pageSize });
    return NextResponse.json({ ok: true, ...payload, filters });
  } catch (error) {
    console.error("[GET /api/admin/alumni/reports]", error);
    return NextResponse.json({ ok: false, error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
