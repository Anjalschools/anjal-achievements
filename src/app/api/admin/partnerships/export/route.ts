import { NextRequest, NextResponse } from "next/server";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import {
  buildPartnershipExport,
  rowsToCsv,
  type PartnershipExportReport,
} from "@/lib/partnerships/partnerships-export-service";
import { requirePartnershipsView } from "@/lib/partnerships/partnerships-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const REPORTS = new Set<PartnershipExportReport>(["organizations", "trainees", "hours", "approvals"]);
const FORMATS = new Set(["csv", "xlsx", "pdf"]);

const buildPdfHtml = (title: string, headers: string[], rows: Array<Record<string, string | number>>) => {
  const escape = (v: string) =>
    v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const head = headers.map((h) => `<th>${escape(h)}</th>`).join("");
  const body = rows
    .map(
      (row) =>
        `<tr>${headers.map((h) => `<td>${escape(String(row[h] ?? ""))}</td>`).join("")}</tr>`
    )
    .join("");
  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/><title>${escape(
    title
  )}</title><style>body{font-family:Arial,sans-serif;padding:24px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #ccc;padding:6px;text-align:right}th{background:#f1f5f9}</style></head><body><h1>${escape(
    title
  )}</h1><p>${new Date().toLocaleString("ar-SA")}</p><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
};

export async function GET(request: NextRequest) {
  const gate = await requirePartnershipsView();
  if (!gate.ok) return gate.response;

  try {
    const { searchParams } = request.nextUrl;
    const report = String(searchParams.get("report") || "trainees").trim() as PartnershipExportReport;
    const format = String(searchParams.get("format") || "csv").trim().toLowerCase();
    const academicYear = String(searchParams.get("academicYear") || "").trim();
    const organizationId = String(searchParams.get("organizationId") || "").trim();

    if (!REPORTS.has(report)) {
      return NextResponse.json({ error: "Invalid report" }, { status: 400 });
    }
    if (!FORMATS.has(format)) {
      return NextResponse.json({ error: "Invalid format" }, { status: 400 });
    }

    const built = await buildPartnershipExport(report, { academicYear, organizationId });
    const filenameBase = `partnerships-${report}-${new Date().toISOString().slice(0, 10)}`;

    if (format === "csv") {
      const csv = rowsToCsv(built.headers, built.rows);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filenameBase}.csv"`,
        },
      });
    }

    if (format === "pdf") {
      const html = buildPdfHtml(built.titleAr, built.headers, built.rows);
      return new NextResponse(html, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filenameBase}.html"`,
        },
      });
    }

    const XLSX = await import("xlsx");
    const sheetRows = [
      { A: built.titleAr },
      { A: `تاريخ التصدير: ${new Date().toISOString()}` },
      {},
      built.headers.reduce<Record<string, string>>((acc, h, i) => {
        acc[String(i)] = h;
        return acc;
      }, {}),
      ...built.rows.map((row) =>
        built.headers.reduce<Record<string, string | number>>((acc, h, i) => {
          acc[String(i)] = String(row[h] ?? "");
          return acc;
        }, {})
      ),
    ];
    const ws = XLSX.utils.json_to_sheet(sheetRows, { skipHeader: true });
    ws["!views"] = [{ rightToLeft: true }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, report);
    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filenameBase}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("[GET /api/admin/partnerships/export]", error);
    return jsonInternalServerError(error);
  }
}
