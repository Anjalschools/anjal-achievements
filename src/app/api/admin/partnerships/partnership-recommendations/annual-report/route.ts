import { NextRequest, NextResponse } from "next/server";
import { jsonInternalServerError } from "@/lib/api-safe-response";
import { requirePartnershipsView } from "@/lib/partnerships/partnerships-auth";
import {
  buildAnnualPartnershipReportExcelRows,
  buildAnnualPartnershipReportPdfHtml,
} from "@/lib/partnerships/partnership-annual-report-service";
import { buildAnnualPartnershipReport } from "@/lib/partnerships/partnership-recommendation-engine-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const gate = await requirePartnershipsView();
  if (!gate.ok) return gate.response;

  try {
    const { searchParams } = request.nextUrl;
    const format = String(searchParams.get("format") || "xlsx").trim().toLowerCase();
    const academicYear = String(searchParams.get("academicYear") || "").trim();
    const report = await buildAnnualPartnershipReport(academicYear || undefined);
    const filenameBase = `partnership-intelligence-${report.academicYearLabel}-${new Date().toISOString().slice(0, 10)}`;

    if (format === "pdf" || format === "html") {
      const html = buildAnnualPartnershipReportPdfHtml(report);
      return new NextResponse(html, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filenameBase}.html"`,
        },
      });
    }

    const built = buildAnnualPartnershipReportExcelRows(report);
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const orgSheet = XLSX.utils.json_to_sheet([
      { A: built.title },
      {},
      built.orgHeaders.reduce<Record<string, string>>((acc, header, index) => {
        acc[String(index)] = header;
        return acc;
      }, {}),
      ...built.orgRows.map((row) =>
        built.orgHeaders.reduce<Record<string, string | number>>((acc, header, index) => {
          acc[String(index)] = row[header as keyof typeof row] ?? "";
          return acc;
        }, {})
      ),
    ]);
    const trendSheet = XLSX.utils.json_to_sheet([
      { A: "الاتجاهات" },
      {},
      built.trendHeaders.reduce<Record<string, string>>((acc, header, index) => {
        acc[String(index)] = header;
        return acc;
      }, {}),
      ...built.trendRows.map((row) =>
        built.trendHeaders.reduce<Record<string, string | number>>((acc, header, index) => {
          acc[String(index)] = row[header as keyof typeof row] ?? "";
          return acc;
        }, {})
      ),
    ]);
    XLSX.utils.book_append_sheet(wb, orgSheet, "Organizations");
    XLSX.utils.book_append_sheet(wb, trendSheet, "Trends");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filenameBase}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("[GET /api/admin/partnerships/partnership-recommendations/annual-report]", error);
    return jsonInternalServerError(error);
  }
}
