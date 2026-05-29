import type { CiPdfExportPreset } from "@/lib/competition-intelligence-theme";
import { getExecutivePdfSectionFlags } from "@/lib/competition-intelligence-theme";
import type { AiDecisionEngineResult } from "@/lib/analytics/ai/ai-decision-schema";
import { exportGovernedExecutiveReport } from "@/lib/pdf/executive-pdf-governance";
import {
  buildFocusedParticipantsTableHtml,
  focusedParticipantsTableEmbedStyles,
} from "@/lib/analytics/export/focused-participants-pdf-document";
import { buildStandardReportHeader } from "@/lib/pdf/components/ExecutivePdfHeader";
import { buildExecutiveMiniTableHtml } from "@/lib/pdf/components/ExecutivePdfTable";
import {
  executivePdfStylesheet,
  EXECUTIVE_PDF_PALETTE,
} from "@/lib/pdf/executive-pdf-theme";
import {
  formatExecutivePdfMetadataHtml,
  type ExecutivePdfMetadata,
} from "@/lib/pdf/executive-pdf-metadata";

export type { ExecutivePdfMetadata };

type ExportRow = Record<string, string | number | null | undefined>;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

export type ExcelExportTraceMeta = {
  generatedAt?: string;
  analyticsBuildId?: string;
  datasetVersion?: number;
  filterHash?: string;
};

export const exportRowsToExcelWorkbook = async (
  rows: ExportRow[],
  headers: string[],
  title: string,
  filenameBase: string,
  opts?: { rtlSheet?: boolean; trace?: ExcelExportTraceMeta; summaryRows?: ExportRow[] }
) => {
  const XLSX = await import("xlsx");
  const now = opts?.trace?.generatedAt ?? new Date().toISOString();
  const sheetRows: Array<Record<string, string | number>> = [];
  sheetRows.push({ A: "إدارة مدارس الأنجال الأهلية" });
  sheetRows.push({ A: title });
  sheetRows.push({ A: `تاريخ التصدير: ${now}` });
  if (opts?.trace?.analyticsBuildId) sheetRows.push({ A: `analyticsBuildId: ${opts.trace.analyticsBuildId}` });
  if (opts?.trace?.datasetVersion != null) sheetRows.push({ A: `datasetVersion: ${opts.trace.datasetVersion}` });
  if (opts?.trace?.filterHash) sheetRows.push({ A: `filterHash: ${opts.trace.filterHash}` });
  sheetRows.push({});
  sheetRows.push(
    headers.reduce<Record<string, string>>((acc, h, i) => {
      acc[String(i)] = h;
      return acc;
    }, {})
  );
  for (const row of rows) {
    sheetRows.push(
      headers.reduce<Record<string, string | number>>((acc, h, i) => {
        acc[String(i)] = String(row[h] ?? "");
        return acc;
      }, {})
    );
  }

  const ws = XLSX.utils.json_to_sheet(sheetRows, { skipHeader: true });
  if (opts?.rtlSheet) {
    ws["!views"] = [{ rightToLeft: true }];
  }
  ws["!cols"] = headers.map(() => ({ wch: 18 }));
  ws["!cols"][4] = { wch: 28 };
  ws["!cols"][10] = { wch: 36 };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "achievement-report");
  if (opts?.summaryRows?.length) {
    const summarySheet = XLSX.utils.json_to_sheet(opts.summaryRows);
    XLSX.utils.book_append_sheet(wb, summarySheet, "analytics-summary");
  }
  const metaSheet = XLSX.utils.aoa_to_sheet([
    ["generatedAt", now],
    ["analyticsBuildId", opts?.trace?.analyticsBuildId ?? ""],
    ["datasetVersion", opts?.trace?.datasetVersion ?? ""],
    ["filterHash", opts?.trace?.filterHash ?? ""],
  ]);
  XLSX.utils.book_append_sheet(wb, metaSheet, "metadata");
  const arr = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  downloadBlob(
    new Blob([arr], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `${filenameBase}.xlsx`
  );
};

export const exportRowsToPrintablePdfView = async (
  rows: ExportRow[],
  headers: string[],
  title: string,
  headerImagePath = "/report-header.png"
) => {
  await exportGovernedExecutiveReport("portrait-table", {
    isAr: true,
    title,
    headers,
    rows,
    orientation: "portrait",
    headerImagePath,
    competitionName: title,
  });
};

/** A4 landscape printable view with optional executive summary (Arabic / RTL). */
export const exportLandscapeExecutivePdfView = async (
  summaryLines: string[],
  rows: ExportRow[],
  headers: string[],
  title: string,
  headerImagePath = "/report-header.png",
  extras?: {
    subtitle?: string;
    /** Pre-escaped small HTML fragments (KPI grids, chart summaries) inserted before the main table */
    blocksHtml?: string;
  }
) => {
  const subtitleBlock = extras?.subtitle
    ? `<p class="ep-subtitle">${escapeHtml(extras.subtitle)}</p>`
    : "";
  await exportGovernedExecutiveReport("landscape-executive", {
    isAr: true,
    title,
    headers,
    rows,
    orientation: "landscape",
    headerImagePath,
    competitionName: title,
    summaryLines,
    filterSummary: extras?.subtitle,
    blocksHtml: `${subtitleBlock}${extras?.blocksHtml ?? ""}`,
  });
};

/** Landscape print view for a subset of participant rows (e.g. checked rows in the executive table). */
export const exportFocusedParticipantSelectionPdf = async (
  opts: {
    isAr: boolean;
    docTitle: string;
    subtitle?: string;
    note?: string;
    headers: string[];
    rows: ExportRow[];
    filterSummary?: string;
  },
  headerImagePath = "/report-header.png"
) => {
  await exportGovernedExecutiveReport("focused-participants", {
    isAr: opts.isAr,
    docTitle: opts.docTitle,
    subtitle: opts.subtitle,
    note: opts.note,
    headers: opts.headers,
    rows: opts.rows,
    headerImagePath,
    filterSummary: opts.filterSummary,
    reportName: opts.isAr ? "جدول المشاركين" : "Participants table",
  });
};

export type FocusedCompetitionPdfKpi = { label: string; value: string };

export type FocusedCompetitionPdfCharts = {
  resultBars: { label: string; count: number }[];
  genderSlices: { label: string; value: number }[];
  sectionSlices: { label: string; value: number }[];
  mawhibaSlices: { label: string; value: number }[];
  yearTrend: {
    year: number;
    records: number;
    distinctStudents: number;
    goldMedals: number;
    excellenceRatePct: number;
  }[];
};

/** Landscape executive PDF for a single competition / program / test (RTL-safe tables). */
export const exportFocusedCompetitionAnalyticsPdf = async (
  opts: {
    isAr: boolean;
    docTitle: string;
    activityTitle: string;
    academicYearLine: string;
    outcomeLine: string;
    kpis: FocusedCompetitionPdfKpi[];
    charts: FocusedCompetitionPdfCharts;
    participantHeaders: string[];
    participantRows: ExportRow[];
    capNote?: string;
    /** Extra HTML inserted before the participant table (executive YoY, breakdowns). Safe; caller must escape. */
    appendHtml?: string;
    metadata?: ExecutivePdfMetadata;
  },
  headerImagePath = "/report-header.png"
): Promise<void> => {
  const dir = opts.isAr ? "rtl" : "ltr";
  const lang = opts.isAr ? "ar" : "en";
  const now = new Date().toLocaleString(opts.isAr ? "ar-SA" : "en-GB");
  const safeDoc = escapeHtml(opts.docTitle);
  const execTitle = escapeHtml(opts.isAr ? "ملخص تنفيذي" : "Executive summary");
  const chartsTitle = escapeHtml(opts.isAr ? "مقارنة النتائج والفئات" : "Results and demographics");
  const tableTitle = escapeHtml(opts.isAr ? "سجل المشاركين" : "Participant register");

  const pdfHeader = buildStandardReportHeader({
    isAr: opts.isAr,
    competitionName: opts.activityTitle,
    reportTypeLabel: opts.docTitle,
    academicYears: opts.academicYearLine,
    outcomeLine: opts.outcomeLine,
    filterSummary: opts.metadata?.filtersSummary,
    generatedAt: now,
    headerBannerPath: headerImagePath,
  });

  const kpiCards = opts.kpis
    .map(
      (k) =>
        `<div class="ep-kpi"><div class="ep-kpi-label">${escapeHtml(k.label)}</div><div class="ep-kpi-value">${escapeHtml(
          k.value
        )}</div></div>`
    )
    .join("");

  const sliceTable = (rows: { label: string; value: number }[], title: string) =>
    `<section class="ep-block">${buildExecutiveMiniTableHtml({
      isAr: opts.isAr,
      title,
      headers: [opts.isAr ? "البند" : "Item", opts.isAr ? "العدد" : "Count"],
      rows: rows.map((r) => ({ label: r.label, value: r.value })),
    })}</section>`;

  const trendRows = opts.charts.yearTrend
    .map(
      (y) =>
        `<tr><td class="num">${y.year}</td><td class="num">${y.records}</td><td class="num">${y.distinctStudents}</td><td class="num">${y.goldMedals}</td><td class="num">${y.excellenceRatePct}%</td></tr>`
    )
    .join("");

  const participantsTable = buildFocusedParticipantsTableHtml({
    headers: opts.participantHeaders,
    rows: opts.participantRows,
    isAr: opts.isAr,
  });

  const cap = opts.capNote ? `<p class="capnote">${escapeHtml(opts.capNote)}</p>` : "";
  const append = opts.appendHtml ?? "";

  const p = EXECUTIVE_PDF_PALETTE;
  const html = `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8" />
<title>${safeDoc}</title>
<style>
  @page { size: A4 landscape; }
  ${executivePdfStylesheet(opts.isAr)}
  ${focusedParticipantsTableEmbedStyles()}
  .exec-panel { border: 1px solid ${p.border}; background: ${p.lightBg}; border-radius: 10px; padding: 12px 14px; margin-bottom: 14px; page-break-inside: avoid; }
  .exec-panel h2 { margin: 0 0 8px 0; font-size: 13px; color: ${p.executiveBlue}; }
  .section-title { font-size: 13px; font-weight: 800; margin: 16px 0 8px 0; page-break-after: avoid; color: ${p.primaryNavy}; }
  .data-wrap { margin-top: 12px; page-break-before: always; }
  .capnote { font-size: 9px; color: ${p.noteText}; margin: 6px 0; }
  .exec-append { margin-top: 12px; page-break-before: always; }
</style></head><body>
<div class="page-shell page-content">
${pdfHeader}
${formatExecutivePdfMetadataHtml(opts.isAr, opts.metadata)}
<section class="exec-panel page-section"><h2>${execTitle}</h2><div class="ep-kpi-grid">${kpiCards}</div></section>
<h2 class="section-title ep-h2">${chartsTitle}</h2>
<div class="ep-charts-grid">
  <div class="ep-block">${buildExecutiveMiniTableHtml({
    isAr: opts.isAr,
    title: opts.isAr ? "توزيع النتائج" : "Result mix",
    headers: [opts.isAr ? "الفئة" : "Category", opts.isAr ? "العدد" : "Count"],
    rows: opts.charts.resultBars.map((r) => ({ label: r.label, value: r.count })),
  })}</div>
  ${sliceTable(opts.charts.genderSlices, opts.isAr ? "الجنس" : "Gender")}
</div>
<div class="ep-charts-grid">
  ${sliceTable(opts.charts.sectionSlices, opts.isAr ? "القسم" : "Section")}
  ${sliceTable(opts.charts.mawhibaSlices, opts.isAr ? "موهبة" : "Mawhiba")}
</div>
<div class="ep-block page-section"><h3>${escapeHtml(opts.isAr ? "تطور السنوات" : "Year trend")}</h3><table class="ep-mini"><thead><tr>
<th>${escapeHtml(opts.isAr ? "السنة" : "Year")}</th>
<th>${escapeHtml(opts.isAr ? "سجلات" : "Records")}</th>
<th>${escapeHtml(opts.isAr ? "طلاب" : "Students")}</th>
<th>${escapeHtml(opts.isAr ? "ذهبي" : "Gold")}</th>
<th>${escapeHtml(opts.isAr ? "نسبة التميز" : "Excellence %")}</th>
</tr></thead><tbody>${trendRows}</tbody></table></div>
${append}
<div class="data-wrap page-section">
<h2 class="section-title ep-h2">${tableTitle}</h2>
${cap}
<div class="ep-table-wrap">${participantsTable.html}</div>
</div>
</div>
</body></html>`;

  await exportGovernedExecutiveReport("focused-competition-analytics", {
    html,
    rowCount: opts.participantRows.length,
    columnCount: opts.participantHeaders.length,
    headerImagePath,
  });
};

export const exportFocusedExecutiveReportPdf = async (
  opts: {
    isAr: boolean;
    docTitle: string;
    activityTitle: string;
    academicYearLine: string;
    outcomeLine: string;
    narrativeAr: string;
    narrativeEn: string;
    alerts: { icon: string; title: string; detail: string }[];
    recommendations: { text: string }[];
    kpis: { label: string; value: string }[];
    medalRows: { label: string; rate: string }[];
    benchmarkRows: { label: string; left: string; right: string; leftPct: string; rightPct: string }[];
    rankingRows: { rank: number; label: string; excellence: string; medalsPer100: string }[];
    charts: FocusedCompetitionPdfCharts;
    participantHeaders: string[];
    participantRows: ExportRow[];
    capNote?: string;
    preset?: CiPdfExportPreset;
    studentIntelRows?: { name: string; rec: string; medals: string; stage: string }[];
    metadata?: ExecutivePdfMetadata;
  },
  headerImagePath = "/report-header.png"
): Promise<void> => {
  const dir = opts.isAr ? "rtl" : "ltr";
  const lang = opts.isAr ? "ar" : "en";
  const now = new Date().toLocaleString(opts.isAr ? "ar-SA" : "en-GB");
  const flags = getExecutivePdfSectionFlags(opts.preset);
  const isBrief = opts.preset === "brief";
  const safeDoc = escapeHtml(opts.docTitle);
  const safeAct = escapeHtml(opts.activityTitle);
  const rawNarr = opts.isAr ? opts.narrativeAr : opts.narrativeEn;
  const narrClipped = isBrief && rawNarr.length > 400 ? `${rawNarr.slice(0, 400)}…` : rawNarr;
  const nar = escapeHtml(narrClipped);
  const alertsUse = isBrief ? opts.alerts.slice(0, 3) : opts.alerts;
  const alertBlock = alertsUse
    .slice(0, 8)
    .map(
      (a) =>
        `<li class="alert-item"><span class="alert-ic">${escapeHtml(a.icon)}</span><strong>${escapeHtml(a.title)}</strong><p>${escapeHtml(a.detail)}</p></li>`
    )
    .join("");
  const kpisUse = isBrief ? opts.kpis.slice(0, 4) : opts.kpis;
  const recUse = isBrief ? opts.recommendations.slice(0, 4) : opts.recommendations;
  const recBlock = recUse.map((r) => `<li>${escapeHtml(r.text)}</li>`).join("");
  const kpiCards = kpisUse
    .map(
      (k) =>
        `<div class="ep-kpi"><div class="ep-kpi-label">${escapeHtml(k.label)}</div><div class="ep-kpi-value">${escapeHtml(k.value)}</div></div>`
    )
    .join("");
  const medalTbody = opts.medalRows
    .map((m) => `<tr><td>${escapeHtml(m.label)}</td><td class="num">${escapeHtml(m.rate)}</td></tr>`)
    .join("");
  const benchTbody = opts.benchmarkRows
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.label)}</td><td class="num">${escapeHtml(r.left)} (${escapeHtml(r.leftPct)}%)</td><td class="num">${escapeHtml(r.right)} (${escapeHtml(r.rightPct)}%)</td></tr>`
    )
    .join("");
  const rankTbody = opts.rankingRows
    .map(
      (r) =>
        `<tr><td class="num">${r.rank}</td><td dir="auto">${escapeHtml(r.label)}</td><td class="num">${escapeHtml(r.excellence)}</td><td class="num">${escapeHtml(r.medalsPer100)}</td></tr>`
    )
    .join("");

  const barRows = opts.charts.resultBars
    .map((r) => `<tr><td>${escapeHtml(r.label)}</td><td class="num">${escapeHtml(String(r.count))}</td></tr>`)
    .join("");
  const trendRows = opts.charts.yearTrend
    .map(
      (y) =>
        `<tr><td class="num">${y.year}</td><td class="num">${y.records}</td><td class="num">${y.distinctStudents}</td><td class="num">${y.goldMedals}</td><td class="num">${y.excellenceRatePct}%</td></tr>`
    )
    .join("");
  const participantsTable = buildFocusedParticipantsTableHtml({
    headers: opts.participantHeaders,
    rows: opts.participantRows,
    isAr: opts.isAr,
  });
  const cap = opts.capNote ? `<p class="capnote">${escapeHtml(opts.capNote)}</p>` : "";
  const align = opts.isAr ? "right" : "left";
  const confFoot = escapeHtml(
    opts.isAr ? "سري — وثيقة داخلية — مدارس الأنجال" : "Confidential — internal use — Al-Anjal Schools"
  );
  const brandFoot = escapeHtml(
    opts.isAr ? "مدارس الأنجال — منصة ذكاء المسابقات" : "Al-Anjal Schools — competition intelligence"
  );
  const wmText = escapeHtml(opts.isAr ? "سري" : "CONFIDENTIAL");
  const metaHtml = formatExecutivePdfMetadataHtml(opts.isAr, opts.metadata);

  const studentIntelTbody =
    opts.studentIntelRows?.length ?
      opts.studentIntelRows
        .map(
          (r) =>
            `<tr><td dir="auto">${escapeHtml(r.name)}</td><td class="num">${escapeHtml(r.rec)}</td><td class="num">${escapeHtml(r.medals)}</td><td dir="auto">${escapeHtml(r.stage)}</td></tr>`
        )
        .join("")
    : "";

  const coverHeader = buildStandardReportHeader({
    isAr: opts.isAr,
    competitionName: opts.activityTitle,
    reportTypeLabel: opts.docTitle,
    academicYears: opts.academicYearLine,
    outcomeLine: opts.outcomeLine,
    filterSummary: opts.metadata?.filtersSummary,
    generatedAt: now,
    headerBannerPath: headerImagePath,
  });

  const coverInner = `
  <div class="ep-wm">${wmText}</div>
  ${coverHeader}
  <p class="ep-kicker">${safeDoc}</p>
  <p class="cover-foot">${confFoot}</p>`;

  const execInner = `
  <div class="ep-wm">${wmText}</div>
  ${buildStandardReportHeader({
    isAr: opts.isAr,
    competitionName: opts.activityTitle,
    reportTypeLabel: opts.docTitle,
    academicYears: opts.academicYearLine,
    outcomeLine: opts.outcomeLine,
    generatedAt: now,
    headerBannerPath: headerImagePath,
    compact: true,
  })}
  ${metaHtml}
  <div class="narr"><strong>${escapeHtml(opts.isAr ? "الملخص التنفيذي" : "Executive summary")}</strong><p>${nar}</p></div>
  <h2>${escapeHtml(opts.isAr ? "تنبيهات قرار" : "Decision alerts")}</h2>
  <div class="alerts"><ul>${alertBlock}</ul></div>
  <div class="ep-kpi-grid">${kpiCards}</div>
  <div class="rec"><strong>${escapeHtml(opts.isAr ? "توصيات قواعدية" : "Rule-based recommendations")}</strong><ol>${recBlock}</ol></div>
  <p class="sign">${escapeHtml(opts.isAr ? "ختم / توقيع اعتماد اللجنة" : "Committee approval / signature")} _____________________</p>`;

  const chartsInner = `
  <div class="ep-wm">${wmText}</div>
  <h2>${escapeHtml(opts.isAr ? "الرسوم التحليلية" : "Analytical charts (tabular)")}</h2>
  <div class="chart-block">
    <h3>${escapeHtml(opts.isAr ? "توزيع النتائج" : "Result distribution")}</h3>
    <table class="grid fixed-chart"><thead><tr><th>${escapeHtml(opts.isAr ? "الفئة" : "Category")}</th><th>${escapeHtml(opts.isAr ? "العدد" : "Count")}</th></tr></thead><tbody>${barRows}</tbody></table>
  </div>
  <div class="chart-block pb-inside">
    <h3>${escapeHtml(opts.isAr ? "تطور السنوات" : "Year-over-year trend")}</h3>
    <table class="grid fixed-chart"><thead><tr><th>${escapeHtml(opts.isAr ? "سنة" : "Year")}</th><th>${escapeHtml(opts.isAr ? "سجلات" : "Rec")}</th><th>${escapeHtml(opts.isAr ? "طلاب" : "Stu")}</th><th>${escapeHtml(opts.isAr ? "ذهبي" : "Au")}</th><th>${escapeHtml(opts.isAr ? "تميز٪" : "Exc%")}</th></tr></thead><tbody>${trendRows}</tbody></table>
  </div>`;

  const medalsInner = `
  <div class="ep-wm">${wmText}</div>
  <h2>${escapeHtml(opts.isAr ? "مقارنة أداء الميداليات" : "Medal performance rates")}</h2>
  <table class="grid"><thead><tr><th>${escapeHtml(opts.isAr ? "المؤشر" : "Metric")}</th><th>${escapeHtml(opts.isAr ? "قيمة" : "Value")}</th></tr></thead><tbody>${medalTbody}</tbody></table>`;

  const benchInner = `
  <div class="ep-wm">${wmText}</div>
  <h2>${escapeHtml(opts.isAr ? "معايير المقارنة المرجعية" : "Benchmark matrix")}</h2>
  <table class="grid"><thead><tr><th>${escapeHtml(opts.isAr ? "البعد" : "Dim")}</th><th>A</th><th>B</th></tr></thead><tbody>${benchTbody}</tbody></table>`;

  const rankInner = `
  <div class="ep-wm">${wmText}</div>
  <h2>${escapeHtml(opts.isAr ? "تصنيف الأنشطة (أعلى اعتماد)" : "Activity ranking (approval rate)")}</h2>
  <table class="grid"><thead><tr><th>#</th><th>${escapeHtml(opts.isAr ? "نشاط" : "Activity")}</th><th>${escapeHtml(opts.isAr ? "اعتماد٪" : "Appr%")}</th><th>${escapeHtml(opts.isAr ? "م/100" : "M/100")}</th></tr></thead><tbody>${rankTbody}</tbody></table>`;

  const studentIntelInner =
    flags.studentIntel && studentIntelTbody ?
      `
  <div class="ep-wm">${wmText}</div>
  <h2 class="ep-h2">${escapeHtml(opts.isAr ? "ذكاء الطلاب (مختصر)" : "Student intelligence (summary)")}</h2>
  <table class="grid"><thead><tr><th>${escapeHtml(opts.isAr ? "الطالب" : "Student")}</th><th>${escapeHtml(opts.isAr ? "سجلات" : "Rec")}</th><th>${escapeHtml(opts.isAr ? "ميداليات" : "Medals")}</th><th>${escapeHtml(opts.isAr ? "المرحلة" : "Stage")}</th></tr></thead><tbody>${studentIntelTbody}</tbody></table>`
    : "";

  const participantsInner = `
  <div class="ep-wm">${wmText}</div>
  <h2 class="ep-h2">${escapeHtml(opts.isAr ? "ملحق المشاركين" : "Participants appendix")}</h2>
  ${cap}
  <div class="ep-table-wrap">${participantsTable.html}</div>`;

  const sectionBodies: string[] = [];
  if (flags.cover) sectionBodies.push(coverInner);
  sectionBodies.push(execInner);
  if (flags.charts) sectionBodies.push(chartsInner);
  if (flags.medals) sectionBodies.push(medalsInner);
  if (flags.benchmarks) sectionBodies.push(benchInner);
  if (flags.ranking) sectionBodies.push(rankInner);
  if (studentIntelInner) sectionBodies.push(studentIntelInner);
  if (flags.participants) sectionBodies.push(participantsInner);

  const total = sectionBodies.length;
  const p = EXECUTIVE_PDF_PALETTE;
  const pagesHtml = sectionBodies
    .map(
      (inner, idx) => `
<div class="page-shell page-content ${idx > 0 ? "page-shell--continuation" : ""}" style="position:relative;padding-bottom:28px;min-height:180mm;">
  ${inner}
  <div class="ep-page-foot"><span class="ep-pnum ep-num">${escapeHtml(opts.isAr ? "صفحة" : "Page")} ${idx + 1} / ${total}</span><span class="ep-conf">${confFoot}</span></div>
  <p class="ep-meta" style="position:absolute;left:12px;right:12px;bottom:0;text-align:center;font-size:7px;">${brandFoot}</p>
</div>`
    )
    .join("");

  const html = `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8" />
<title>${safeDoc}</title>
<style>
  @page { size: A4 landscape; }
  ${executivePdfStylesheet(opts.isAr)}
  ${focusedParticipantsTableEmbedStyles()}
  .page-shell--continuation { page-break-before: always; }
  .cover-foot { margin-top: 24px; font-size: 9px; color: ${p.muted}; font-weight: 700; border-top: 1px solid ${p.border}; padding-top: 10px; }
  .narr { border: 1px solid ${p.border}; background: ${p.lightBg}; padding: 10px; border-radius: 8px; margin-bottom: 10px; break-inside: avoid; }
  .alerts ul { margin: 0; padding: 0; list-style: none; }
  .alert-item { border-bottom: 1px solid ${p.border}; padding: 6px 0; break-inside: avoid; }
  .alert-ic { margin-inline-end: 6px; }
  .rec { margin-top: 10px; break-inside: avoid; }
  table.grid { width: 100%; border-collapse: collapse; font-size: 9px; margin-top: 6px; table-layout: fixed; }
  table.grid th, table.grid td { border: 1px solid ${p.border}; padding: 5px 6px; text-align: ${align}; word-wrap: break-word; vertical-align: middle; }
  table.grid th { background: ${p.headerBg}; }
  table.grid thead { display: table-header-group; }
  table.grid tbody tr { break-inside: avoid; page-break-inside: avoid; }
  .chart-block { break-inside: avoid; margin-bottom: 8px; }
  .sign { margin-top: 12px; font-size: 9px; color: ${p.muted}; border-top: 1px solid ${p.border}; padding-top: 8px; break-inside: avoid; }
  .capnote { color: ${p.noteText}; font-size: 9px; }
  .ep-kpi-grid { grid-template-columns: repeat(5, 1fr); }
</style></head><body>
${pagesHtml}
</body></html>`;

  await exportGovernedExecutiveReport("focused-executive-report", {
    html,
    rowCount: opts.participantRows?.length ?? 0,
    pageCount: total,
    headerImagePath,
  });
};

export const decisionRowsForExport = (
  result: AiDecisionEngineResult,
  isAr: boolean
): { headers: string[]; rows: ExportRow[] } => {
  const headers = isAr
    ? ["القرار", "الشدة", "الثقة", "الملخص", "الأثر المتوقع"]
    : ["Decision", "Severity", "Confidence", "Summary", "Expected outcome"];
  const rows: ExportRow[] = result.bundle.decisions.map((d) => ({
    [headers[0]!]: isAr ? d.titleAr : d.titleEn,
    [headers[1]!]: d.severity,
    [headers[2]!]: d.confidence,
    [headers[3]!]: isAr ? d.executiveSummaryAr : d.executiveSummaryEn,
    [headers[4]!]: isAr ? d.expectedOutcomeAr : d.expectedOutcomeEn,
  }));
  return { headers, rows };
};

/** Printable AI executive decisions (RTL/LTR). */
export const exportExecutiveDecisionsPdf = async (
  result: AiDecisionEngineResult,
  title: string,
  isAr: boolean,
  headerImagePath = "/report-header.png"
) => {
  await exportGovernedExecutiveReport("executive-decisions", {
    result,
    title,
    isAr,
    headerImagePath,
  });
};

export const exportExecutiveDecisionsExcel = async (
  result: AiDecisionEngineResult,
  title: string,
  isAr: boolean,
  filenameBase = "executive-decisions"
) => {
  const { headers, rows } = decisionRowsForExport(result, isAr);
  const summary = [
    { metric: isAr ? "العنوان" : "Headline", value: isAr ? result.boardSummary.headlineAr : result.boardSummary.headlineEn },
    { metric: isAr ? "أفضل استثمار" : "Best investment", value: isAr ? result.boardSummary.bestInvestmentAr : result.boardSummary.bestInvestmentEn },
  ];
  await exportRowsToExcelWorkbook(rows, headers, title, filenameBase, {
    rtlSheet: isAr,
    summaryRows: summary,
  });
};
