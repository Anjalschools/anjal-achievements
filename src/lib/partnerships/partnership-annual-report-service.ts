import type { AnnualPartnershipReport } from "@/lib/partnerships/partnership-recommendation-types";
import { trainingOutcomeLabel } from "@/lib/partnerships/partnership-recommendation-constants";

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const buildAnnualPartnershipReportRows = (report: AnnualPartnershipReport) => {
  const orgRows = report.topOrganizations.map((row, index) => ({
    rank: index + 1,
    organizationName: row.organizationName,
    combinedScore: row.combinedScore,
    recommendationRatePct: row.recommendationRatePct,
  }));

  const trendRows = [
    ...report.successTrends.map((row) => ({
      section: "success",
      label: row.label,
      value: row.value,
    })),
    ...report.studentSatisfactionTrends.map((row) => ({
      section: "satisfaction",
      label: row.label,
      value: row.average,
    })),
    ...report.completionTrends.map((row) => ({
      section: "completion",
      label: row.label,
      value: row.ratePct,
    })),
    ...report.recommendationTrends.map((row) => ({
      section: "recommendation",
      label: row.label,
      value: row.ratePct,
    })),
  ];

  return { orgRows, trendRows };
};

export const buildAnnualPartnershipReportPdfHtml = (report: AnnualPartnershipReport) => {
  const { orgRows, trendRows } = buildAnnualPartnershipReportRows(report);
  const orgBody = orgRows
    .map(
      (row) =>
        `<tr><td>${row.rank}</td><td>${escapeHtml(row.organizationName)}</td><td>${row.combinedScore}%</td><td>${row.recommendationRatePct}%</td></tr>`
    )
    .join("");
  const trendBody = trendRows
    .map(
      (row) =>
        `<tr><td>${escapeHtml(row.section)}</td><td>${escapeHtml(row.label)}</td><td>${row.value}</td></tr>`
    )
    .join("");

  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/><title>تقرير الشراكات السنوي</title><style>body{font-family:Arial,sans-serif;padding:24px}h1,h2{font-size:18px}table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:24px}th,td{border:1px solid #ccc;padding:6px;text-align:right}th{background:#f1f5f9}</style></head><body><h1>تقرير ذكاء الشراكات السنوي</h1><p>العام: ${escapeHtml(report.academicYearLabel)} · ${escapeHtml(report.generatedAt)}</p><h2>أفضل الجهات</h2><table><thead><tr><th>#</th><th>الجهة</th><th>الدرجة</th><th>التوصية</th></tr></thead><tbody>${orgBody}</tbody></table><h2>الاتجاهات</h2><table><thead><tr><th>المؤشر</th><th>الفترة</th><th>القيمة</th></tr></thead><tbody>${trendBody}</tbody></table></body></html>`;
};

export const buildAnnualPartnershipReportExcelRows = (report: AnnualPartnershipReport) => {
  const { orgRows, trendRows } = buildAnnualPartnershipReportRows(report);
  return {
    title: `تقرير ذكاء الشراكات — ${report.academicYearLabel}`,
    orgHeaders: ["#", "الجهة", "الدرجة المركبة", "نسبة التوصية"],
    orgRows: orgRows.map((row) => ({
      "#": row.rank,
      "الجهة": row.organizationName,
      "الدرجة المركبة": row.combinedScore,
      "نسبة التوصية": row.recommendationRatePct,
    })),
    trendHeaders: ["المؤشر", "الفترة", "القيمة"],
    trendRows: trendRows.map((row) => ({
      "المؤشر": row.section,
      "الفترة": row.label,
      "القيمة": row.value,
    })),
  };
};

export const outcomeLevelAr = (key: string) => trainingOutcomeLabel(key as never, true);
