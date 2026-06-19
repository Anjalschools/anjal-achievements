import type { SchoolImprovementFullDiagnostics } from "@/lib/school-improvement/intelligence-diagnostics-types";

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const buildIntelligenceDiagnosticsExportHtml = (
  diagnostics: SchoolImprovementFullDiagnostics,
  locale: "ar" | "en"
): string => {
  const isAr = locale === "ar";
  const dir = isAr ? "rtl" : "ltr";
  const title = isAr ? "تقرير تشخيص ذكاء التحسين المدرسي" : "School improvement intelligence diagnostics report";
  const score = diagnostics.healthScore?.score ?? "—";
  const band = isAr ? diagnostics.healthScore?.labelAr : diagnostics.healthScore?.labelEn;

  const sectionRows = diagnostics.sectionReports
    .map(
      (section) => `
      <tr>
        <td>${escapeHtml(section.section)}</td>
        <td>${escapeHtml(section.status)}</td>
        <td>${section.durationMs}</td>
        <td>${escapeHtml(section.service || "—")}</td>
        <td>${escapeHtml(section.error?.message || "—")}</td>
      </tr>`
    )
    .join("");

  const queryRows = diagnostics.mongoQueries
    .slice(0, 50)
    .map(
      (query) => `
      <tr>
        <td>${escapeHtml(query.collection)}</td>
        <td>${escapeHtml(query.pipelineName || query.operation)}</td>
        <td>${query.durationMs}</td>
        <td>${query.documentsReturned}</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="${isAr ? "ar" : "en"}" dir="${dir}">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
    h1,h2 { margin: 0 0 12px; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0 24px; font-size: 12px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: ${isAr ? "right" : "left"}; }
    th { background: #f5f5f5; }
    .score { font-size: 28px; font-weight: bold; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(isAr ? "تاريخ التوليد" : "Generated at")}: ${escapeHtml(diagnostics.generatedAt)}</p>
  <p class="score">${escapeHtml(isAr ? "مؤشر الصحة" : "Health score")}: ${score}/100 ${band ? `(${escapeHtml(band)})` : ""}</p>
  <h2>${escapeHtml(isAr ? "تقارير الأقسام" : "Section reports")}</h2>
  <table>
    <thead><tr><th>${escapeHtml(isAr ? "القسم" : "Section")}</th><th>${escapeHtml(isAr ? "الحالة" : "Status")}</th><th>${escapeHtml(isAr ? "المدة" : "Duration")}</th><th>${escapeHtml(isAr ? "الخدمة" : "Service")}</th><th>${escapeHtml(isAr ? "الخطأ" : "Error")}</th></tr></thead>
    <tbody>${sectionRows}</tbody>
  </table>
  <h2>${escapeHtml(isAr ? "استعلامات Mongo" : "Mongo queries")}</h2>
  <table>
    <thead><tr><th>${escapeHtml(isAr ? "المجموعة" : "Collection")}</th><th>${escapeHtml(isAr ? "العملية" : "Operation")}</th><th>${escapeHtml(isAr ? "المدة" : "Duration")}</th><th>${escapeHtml(isAr ? "النتائج" : "Docs")}</th></tr></thead>
    <tbody>${queryRows}</tbody>
  </table>
</body>
</html>`;
};

export const buildIntelligenceDiagnosticsExcelRows = (diagnostics: SchoolImprovementFullDiagnostics) => {
  const headers = ["Section", "Status", "DurationMs", "Service", "Error"];
  const rows = diagnostics.sectionReports.map((section) => ({
    Section: section.section,
    Status: section.status,
    DurationMs: section.durationMs,
    Service: section.service || "",
    Error: section.error?.message || "",
  }));
  const summaryRows = [
    { Section: "healthScore", Status: String(diagnostics.healthScore?.score ?? ""), DurationMs: "", Service: diagnostics.healthScore?.band || "", Error: "" },
  ];
  return { headers, rows, summaryRows, title: "Intelligence Diagnostics" };
};

export const buildIntelligenceDiagnosticsExcelBuffer = async (
  diagnostics: SchoolImprovementFullDiagnostics
): Promise<Buffer> => {
  const XLSX = await import("xlsx");
  const { headers, rows, summaryRows, title } = buildIntelligenceDiagnosticsExcelRows(diagnostics);
  const sheetRows: Array<Record<string, string | number>> = [
    { A: title },
    { A: diagnostics.generatedAt },
    {},
    headers.reduce<Record<string, string>>((acc, header, index) => {
      acc[String(index)] = header;
      return acc;
    }, {}),
    ...rows.map((row) =>
      headers.reduce<Record<string, string | number>>((acc, header, index) => {
        acc[String(index)] = String(row[header as keyof typeof row] ?? "");
        return acc;
      }, {})
    ),
  ];
  const ws = XLSX.utils.json_to_sheet(sheetRows, { skipHeader: true });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "diagnostics");
  if (summaryRows.length) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), "summary");
  }
  const arr = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  return Buffer.from(arr);
};
