import type { CiPdfExportPreset } from "@/lib/competition-intelligence-theme";
import { getExecutivePdfSectionFlags } from "@/lib/competition-intelligence-theme";
import { logExportIntel } from "@/lib/competition-intelligence-debug";

type ExportRow = Record<string, string | number | null | undefined>;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const ciRunPrintDiagnostics = async (params: {
  correlationId: string | undefined;
  surface: string;
  doc: Document;
  win: Window;
  retryAttempt?: number;
}): Promise<void> => {
  const cid =
    params.correlationId && String(params.correlationId).trim().length > 0 ?
      String(params.correlationId).trim()
    : "anon";
  const attempt = params.retryAttempt ?? 1;
  const waitImages = () =>
    new Promise<void>((resolve, reject) => {
      const imgs = Array.from(params.doc.querySelectorAll("img"));
      let pending = imgs.filter((im) => !im.complete).length;
      const finish = () => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      };
      if (pending === 0) {
        finish();
        return;
      }
      const t = window.setTimeout(() => reject(new Error("Image load timeout")), 50_000);
      const doneOne = () => {
        pending -= 1;
        if (pending <= 0) {
          window.clearTimeout(t);
          finish();
        }
      };
      for (const im of imgs) {
        if (im.complete) continue;
        im.onload = () => doneOne();
        im.onerror = () => doneOne();
      }
    });

  const t0 = performance.now();
  try {
    const t1 = performance.now();
    logExportIntel({
      correlationId: cid,
      phase: `${params.surface}_iframe_ready`,
      durationMs: Math.round(t1 - t0),
      retryAttempt: attempt,
    });
    await waitImages();
    const t2 = performance.now();
    logExportIntel({
      correlationId: cid,
      phase: `${params.surface}_chart_readiness`,
      durationMs: Math.round(t2 - t1),
      retryAttempt: attempt,
    });
    params.win.focus();
    const t3 = performance.now();
    params.win.print();
    const t4 = performance.now();
    logExportIntel({
      correlationId: cid,
      phase: `${params.surface}_print_trigger`,
      durationMs: Math.round(t4 - t3),
      retryAttempt: attempt,
    });
    logExportIntel({
      correlationId: cid,
      phase: `${params.surface}_export_total`,
      durationMs: Math.round(t4 - t0),
      retryAttempt: attempt,
    });
  } catch (e) {
    logExportIntel({
      correlationId: cid,
      phase: `${params.surface}_export_failed`,
      durationMs: Math.round(performance.now() - t0),
      retryAttempt: attempt,
      failedSections: ["print_assets"],
      extra: { err: e instanceof Error ? e.message.slice(0, 80) : "error" },
    });
    throw e;
  }
};

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

export const exportRowsToExcelWorkbook = async (
  rows: ExportRow[],
  headers: string[],
  title: string,
  filenameBase: string,
  opts?: { rtlSheet?: boolean }
) => {
  const XLSX = await import("xlsx");
  const now = new Date().toLocaleString("ar-SA");
  const sheetRows: Array<Record<string, string | number>> = [];
  sheetRows.push({ A: "إدارة مدارس الأنجال الأهلية" });
  sheetRows.push({ A: title });
  sheetRows.push({ A: `تاريخ التصدير: ${now}` });
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
  const now = new Date().toLocaleString("ar-SA");
  const safeTitle = escapeHtml(title);
  const tableHead = headers.map((h) => `<th>${escapeHtml(String(h))}</th>`).join("");
  const tableBody = rows
    .map(
      (r) =>
        `<tr>${headers
          .map((h) => `<td>${String(r[h] ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>`)
          .join("")}</tr>`
    )
    .join("");

  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8" />
  <title>${safeTitle}</title>
  <style>
    body { font-family: Tahoma, Arial, sans-serif; margin: 24px; color: #0f172a; }
    .header img { max-width: 100%; height: auto; margin-bottom: 12px; }
    h1 { font-size: 20px; margin: 0 0 8px 0; }
    .meta { font-size: 12px; color: #475569; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: right; vertical-align: top; }
    th { background: #f1f5f9; }
    @media print { body { margin: 8mm; } }
  </style>
  </head><body>
    <div class="header"><img src="${headerImagePath}" alt="" /></div>
    <h1>${safeTitle}</h1>
    <div class="meta">تاريخ التصدير: ${escapeHtml(now)}</div>
    <table><thead><tr>${tableHead}</tr></thead><tbody>${tableBody}</tbody></table>
  </body></html>`;

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  iframe.style.left = "-10000px";
  document.body.appendChild(iframe);
  const win = iframe.contentWindow;
  const doc = win?.document;
  if (!doc || !win) {
    iframe.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  /* No inline <script> in iframe (CSP). Trigger print from parent after img load. */
  const schedulePrint = () => {
    setTimeout(() => {
      win.print();
    }, 250);
  };
  const img = doc.querySelector("img");
  if (!img) {
    schedulePrint();
  } else if (img.complete) {
    schedulePrint();
  } else {
    img.onload = () => schedulePrint();
    img.onerror = () => schedulePrint();
  }

  setTimeout(() => {
    iframe.remove();
  }, 5000);
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
  const now = new Date().toLocaleString("ar-SA");
  const safeTitle = escapeHtml(title);
  const tableHead = headers.map((h) => `<th>${escapeHtml(String(h))}</th>`).join("");
  const tableBody = rows
    .map(
      (r) =>
        `<tr>${headers
          .map((h) => `<td>${String(r[h] ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>`)
          .join("")}</tr>`
    )
    .join("");
  const summaryHtml = summaryLines
    .map((line) => `<li style="margin:0 0 6px 0;">${escapeHtml(line)}</li>`)
    .join("");

  const subtitleHtml = extras?.subtitle
    ? `<h2 style="font-size:15px;margin:10px 0 6px 0;color:#0f172a">${escapeHtml(extras.subtitle)}</h2>`
    : "";
  const blocks = extras?.blocksHtml ? extras.blocksHtml : "";

  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8" />
  <title>${safeTitle}</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    body { font-family: Tahoma, Arial, sans-serif; margin: 16px; color: #0f172a; font-size: 11px; line-height: 1.35; }
    .header img { max-width: 100%; height: auto; margin-bottom: 12px; }
    h1 { font-size: 18px; margin: 0 0 8px 0; }
    .meta { font-size: 11px; color: #475569; margin-bottom: 10px; }
    .exec { font-size: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 16px; margin-bottom: 14px; page-break-inside: avoid; }
    .exec ul { margin: 8px 0 0 0; padding: 0 20px 0 0; }
    table.main { width: 100%; border-collapse: collapse; font-size: 9.5px; table-layout: fixed; }
    table.main thead { display: table-header-group; }
    table.main th, table.main td {
      border: 1px solid #cbd5e1; padding: 5px 6px; text-align: right; vertical-align: top;
      word-break: normal; overflow-wrap: anywhere;
    }
    table.main th { background: #f1f5f9; font-weight: 700; white-space: normal; }
    table.main tr { break-inside: avoid; page-break-inside: avoid; }
    @media print { body { margin: 0; } }
  </style>
  </head><body>
    <div class="header"><img src="${headerImagePath}" alt="" /></div>
    <h1>${safeTitle}</h1>
    <div class="meta">تاريخ التصدير: ${escapeHtml(now)}</div>
    ${subtitleHtml}
    <div class="exec"><strong>ملخص تنفيذي</strong><ul>${summaryHtml}</ul></div>
    ${blocks}
    <table class="main"><thead><tr>${tableHead}</tr></thead><tbody>${tableBody}</tbody></table>
  </body></html>`;

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  iframe.style.left = "-10000px";
  document.body.appendChild(iframe);
  const win = iframe.contentWindow;
  const doc = win?.document;
  if (!doc || !win) {
    iframe.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  const schedulePrint = () => {
    setTimeout(() => {
      win.print();
    }, 280);
  };
  const img = doc.querySelector("img");
  if (!img) {
    schedulePrint();
  } else if (img.complete) {
    schedulePrint();
  } else {
    img.onload = () => schedulePrint();
    img.onerror = () => schedulePrint();
  }

  setTimeout(() => {
    iframe.remove();
  }, 5000);
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
  },
  headerImagePath = "/report-header.png"
) => {
  const dir = opts.isAr ? "rtl" : "ltr";
  const lang = opts.isAr ? "ar" : "en";
  const align = opts.isAr ? "right" : "left";
  const numAlign = opts.isAr ? "left" : "right";
  const now = new Date().toLocaleString(opts.isAr ? "ar-SA" : "en-GB");
  const safeTitle = escapeHtml(opts.docTitle);
  const sub = opts.subtitle ? `<p class="sub">${escapeHtml(opts.subtitle)}</p>` : "";
  const note = opts.note ? `<p class="note">${escapeHtml(opts.note)}</p>` : "";
  const gen =
    opts.isAr
      ? `تاريخ الإخراج: ${escapeHtml(now)}`
      : `Generated: ${escapeHtml(now)}`;
  const heads = opts.headers.map((h) => `<th>${escapeHtml(String(h))}</th>`).join("");
  const body = opts.rows
    .map((r, ri) => {
      const zebra = ri % 2 === 1 ? " zebra" : "";
      return `<tr class="${zebra}">${opts.headers
        .map((h) => `<td>${String(r[h] ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>`)
        .join("")}</tr>`;
    })
    .join("");

  const html = `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8" />
<title>${safeTitle}</title>
<style>
  @page { size: A4 landscape; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: Tahoma, "Segoe UI", Arial, sans-serif; margin: 12px; color: #0f172a; font-size: 10.5px; line-height: 1.45; }
  .header img { max-width: 100%; height: auto; margin-bottom: 12px; }
  h1 { font-size: 18px; font-weight: 800; margin: 0 0 6px 0; color: #0f172a; }
  .sub { font-size: 11px; color: #475569; margin: 0 0 8px 0; }
  .note { font-size: 9.5px; color: #b45309; margin: 0 0 10px 0; }
  .meta { font-size: 10px; color: #64748b; margin-bottom: 14px; }
  table.data { width: 100%; border-collapse: collapse; font-size: 9px; table-layout: fixed; }
  table.data thead { display: table-header-group; }
  table.data th, table.data td {
    border: 1px solid #cbd5e1;
    padding: 6px 7px;
    text-align: ${align};
    vertical-align: top;
    word-break: normal;
    overflow-wrap: anywhere;
  }
  table.data th {
    background: #e2e8f0;
    font-weight: 800;
    white-space: normal;
  }
  table.data tr.zebra td { background: #f8fafc; }
  table.data tr { break-inside: avoid; page-break-inside: avoid; }
  td:nth-child(9), td:nth-child(12), th:nth-child(9), th:nth-child(12) { text-align: ${numAlign}; font-variant-numeric: tabular-nums; }
  footer { margin-top: 14px; font-size: 9px; color: #94a3b8; }
  @media print { body { margin: 0; } }
</style></head><body>
<div class="header"><img src="${headerImagePath}" alt="" /></div>
<h1 dir="auto">${safeTitle}</h1>
${sub}
<p class="meta">${gen}</p>
${note}
<table class="data"><thead><tr>${heads}</tr></thead><tbody>${body}</tbody></table>
<footer>${escapeHtml(
    opts.isAr ? "تصدير مختار — مدارس الأنجال الأهلية" : "Selected export — Al-Anjal Schools"
  )}</footer>
</body></html>`;

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  iframe.style.left = "-10000px";
  document.body.appendChild(iframe);
  const win = iframe.contentWindow;
  const doc = win?.document;
  if (!doc || !win) {
    iframe.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  const schedulePrint = () => {
    setTimeout(() => {
      win.print();
    }, 300);
  };
  const img = doc.querySelector("img");
  if (!img) schedulePrint();
  else if (img.complete) schedulePrint();
  else {
    img.onload = () => schedulePrint();
    img.onerror = () => schedulePrint();
  }
  setTimeout(() => iframe.remove(), 5000);
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

export type ExecutivePdfMetadata = {
  generatedAtIso: string;
  generatedBy?: string;
  filtersSummary?: string;
  activityFocus?: string;
  reportPreset?: string;
  confidentiality?: string;
  correlationId?: string;
  aggregationVersion?: number;
  snapshotVersion?: number;
  trustStatus?: string;
  degradedExport?: boolean;
};

const formatExecutivePdfMetadataHtml = (
  isAr: boolean,
  meta: ExecutivePdfMetadata | undefined
): string => {
  if (!meta) return "";
  const metaRows = (
    [
      [isAr ? "تاريخ الإنشاء (ISO)" : "Generated at (ISO)", meta.generatedAtIso],
      meta.correlationId ? [isAr ? "معرّف التصدير" : "Export correlation id", meta.correlationId] : null,
      meta.generatedBy ? [isAr ? "أنشأه" : "Generated by", meta.generatedBy] : null,
      meta.filtersSummary ? [isAr ? "ملخص الفلاتر" : "Filters summary", meta.filtersSummary] : null,
      meta.activityFocus ? [isAr ? "تركيز النشاط" : "Activity focus", meta.activityFocus] : null,
      meta.reportPreset ? [isAr ? "قالب التقرير" : "Report preset", meta.reportPreset] : null,
      meta.confidentiality ? [isAr ? "تصنيف السرية" : "Confidentiality level", meta.confidentiality] : null,
      meta.aggregationVersion != null ?
        [isAr ? "إصدار التجميع" : "Aggregation version", String(meta.aggregationVersion)]
      : null,
      meta.snapshotVersion != null ?
        [isAr ? "إصدار اللقطة" : "Snapshot version", String(meta.snapshotVersion)]
      : null,
      meta.trustStatus ? [isAr ? "حالة الموثوقية" : "Trust status", meta.trustStatus] : null,
      meta.degradedExport ?
        [isAr ? "وضع التصدير" : "Export mode", isAr ? "مخفّض" : "Degraded"]
      : null,
    ] as Array<[string, string] | null>
  ).filter((x): x is [string, string] => Array.isArray(x));
  if (metaRows.length === 0) return "";
  return `<div class="meta-block"><table class="meta-grid">${metaRows
    .map(
      ([k, v]) =>
        `<tr><th>${escapeHtml(k)}</th><td dir="auto">${escapeHtml(v)}</td></tr>`
    )
    .join("")}</table></div>`;
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
  const safeAct = escapeHtml(opts.activityTitle);
  const execTitle = escapeHtml(opts.isAr ? "ملخص تنفيذي" : "Executive summary");
  const chartsTitle = escapeHtml(opts.isAr ? "مقارنة النتائج والفئات" : "Results and demographics");
  const tableTitle = escapeHtml(opts.isAr ? "سجل المشاركين" : "Participant register");
  const genLabel = escapeHtml(opts.isAr ? "تاريخ الإخراج" : "Generated");
  const foot = escapeHtml(
    opts.isAr
      ? "تقرير تحليل نشاط محدد — مدارس الأنجال الأهلية"
      : "Focused activity analytics — Al-Anjal Schools"
  );

  const kpiCards = opts.kpis
    .map(
      (k) =>
        `<div class="kpi"><div class="kpi-label">${escapeHtml(k.label)}</div><div class="kpi-value">${escapeHtml(
          k.value
        )}</div></div>`
    )
    .join("");

  const barRows = opts.charts.resultBars
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.label)}</td><td class="num">${escapeHtml(String(r.count))}</td></tr>`
    )
    .join("");

  const sliceTable = (rows: { label: string; value: number }[], title: string) => {
    const body = rows
      .map(
        (r) =>
          `<tr><td>${escapeHtml(r.label)}</td><td class="num">${escapeHtml(String(r.value))}</td></tr>`
      )
      .join("");
    return `<section class="block"><h3>${escapeHtml(title)}</h3><table class="mini"><thead><tr><th>${escapeHtml(
      opts.isAr ? "البند" : "Item"
    )}</th><th>${escapeHtml(opts.isAr ? "العدد" : "Count")}</th></tr></thead><tbody>${body}</tbody></table></section>`;
  };

  const trendRows = opts.charts.yearTrend
    .map(
      (y) =>
        `<tr><td class="num">${y.year}</td><td class="num">${y.records}</td><td class="num">${y.distinctStudents}</td><td class="num">${y.goldMedals}</td><td class="num">${y.excellenceRatePct}%</td></tr>`
    )
    .join("");

  const heads = opts.participantHeaders.map((h) => `<th>${escapeHtml(String(h))}</th>`).join("");
  const body = opts.participantRows
    .map(
      (r) =>
        `<tr>${opts.participantHeaders
          .map((h) => `<td>${String(r[h] ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>`)
          .join("")}</tr>`
    )
    .join("");

  const cap = opts.capNote ? `<p class="capnote">${escapeHtml(opts.capNote)}</p>` : "";
  const append = opts.appendHtml ?? "";

  const html = `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8" />
<title>${safeDoc}</title>
<style>
  @page { size: A4 landscape; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: Tahoma, "Segoe UI", Arial, sans-serif; margin: 14px; color: #0f172a; font-size: 10.5px; line-height: 1.45; }
  .header img { max-width: 100%; height: auto; margin-bottom: 12px; }
  h1.act { font-size: 22px; font-weight: 800; margin: 0 0 4px 0; color: #0f172a; }
  .sub { font-size: 12px; color: #475569; margin: 0 0 10px 0; }
  .meta { font-size: 10px; color: #64748b; margin-bottom: 12px; }
  .exec { border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 10px; padding: 12px 14px; margin-bottom: 14px; page-break-inside: avoid; }
  .exec h2 { margin: 0 0 8px 0; font-size: 13px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 8px; }
  .kpi { border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; background: #fff; }
  .kpi-label { font-size: 9px; color: #64748b; font-weight: 700; }
  .kpi-value { font-size: 15px; font-weight: 800; margin-top: 4px; }
  .section-title { font-size: 13px; font-weight: 800; margin: 16px 0 8px 0; page-break-after: avoid; }
  .charts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; overflow: hidden; }
  .block { border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; background: #fff; page-break-inside: avoid; }
  .block h3 { margin: 0 0 6px 0; font-size: 11px; font-weight: 800; }
  .exec-append { margin-top: 12px; page-break-before: always; }
  .exec-append h2 { font-size: 12px; font-weight: 800; margin: 0 0 8px 0; }
  table.mini { width: 100%; border-collapse: collapse; font-size: 9.5px; }
  table.mini th, table.mini td { border: 1px solid #cbd5e1; padding: 5px 7px; text-align: ${opts.isAr ? "right" : "left"}; vertical-align: top; }
  table.mini th { background: #f1f5f9; }
  table.mini tbody tr:nth-child(even) td { background: #f8fafc; }
  .num { font-variant-numeric: tabular-nums; white-space: nowrap; }
  .data-wrap { margin-top: 12px; page-break-before: always; }
  table.data { width: 100%; border-collapse: collapse; font-size: 8.75px; table-layout: fixed; }
  table.data thead { display: table-header-group; }
  table.data th, table.data td {
    border: 1px solid #cbd5e1;
    padding: 5px 6px;
    text-align: ${opts.isAr ? "right" : "left"};
    vertical-align: top;
    word-break: normal;
    overflow-wrap: anywhere;
    hyphens: none;
  }
  table.data th {
    background: #e2e8f0;
    font-weight: 800;
    white-space: normal;
  }
  table.data tbody tr:nth-child(even) td { background: #f8fafc; }
  table.data tr { break-inside: avoid; page-break-inside: avoid; }
  .capnote { font-size: 9px; color: #b45309; margin: 6px 0; }
  footer { margin-top: 12px; font-size: 9px; color: #94a3b8; }
  .meta-block { margin: 8px 0 10px; break-inside: avoid; page-break-inside: avoid; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; background: #fff; }
  table.meta-grid { width: 100%; font-size: 8px; border-collapse: collapse; }
  table.meta-grid th, table.meta-grid td { border: 1px solid #e2e8f0; padding: 4px 6px; text-align: ${opts.isAr ? "right" : "left"}; vertical-align: top; }
  table.meta-grid th { width: 28%; background: #f1f5f9; color: #475569; font-weight: 700; }
  @media print { body { margin: 0; } }
</style></head><body>
<div class="header"><img src="${headerImagePath}" alt="" /></div>
<h1 class="act" dir="auto">${safeAct}</h1>
<p class="sub" dir="auto">${escapeHtml(opts.academicYearLine)} · ${escapeHtml(opts.outcomeLine)}</p>
<p class="meta">${genLabel}: ${escapeHtml(now)}</p>
${formatExecutivePdfMetadataHtml(opts.isAr, opts.metadata)}
<section class="exec"><h2>${execTitle}</h2><div class="kpi-grid">${kpiCards}</div></section>
<h2 class="section-title">${chartsTitle}</h2>
<div class="charts-grid">
  <div class="block"><h3>${escapeHtml(opts.isAr ? "توزيع النتائج" : "Result mix")}</h3><table class="mini"><thead><tr><th>${escapeHtml(
    opts.isAr ? "الفئة" : "Category"
  )}</th><th>${escapeHtml(opts.isAr ? "العدد" : "Count")}</th></tr></thead><tbody>${barRows}</tbody></table></div>
  ${sliceTable(opts.charts.genderSlices, opts.isAr ? "الجنس" : "Gender")}
</div>
<div class="charts-grid">
  ${sliceTable(opts.charts.sectionSlices, opts.isAr ? "القسم" : "Section")}
  ${sliceTable(opts.charts.mawhibaSlices, opts.isAr ? "موهبة" : "Mawhiba")}
</div>
<div class="block"><h3>${escapeHtml(opts.isAr ? "تطور السنوات" : "Year trend")}</h3><table class="mini"><thead><tr>
<th>${escapeHtml(opts.isAr ? "السنة" : "Year")}</th>
<th>${escapeHtml(opts.isAr ? "سجلات" : "Records")}</th>
<th>${escapeHtml(opts.isAr ? "طلاب" : "Students")}</th>
<th>${escapeHtml(opts.isAr ? "ذهبي" : "Gold")}</th>
<th>${escapeHtml(opts.isAr ? "نسبة التميز" : "Excellence %")}</th>
</tr></thead><tbody>${trendRows}</tbody></table></div>
${append}
<div class="data-wrap">
<h2 class="section-title">${tableTitle}</h2>
${cap}
<table class="data"><thead><tr>${heads}</tr></thead><tbody>${body}</tbody></table>
</div>
<footer>${foot}</footer>
</body></html>`;

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  iframe.style.left = "-10000px";
  document.body.appendChild(iframe);
  const win = iframe.contentWindow;
  const doc = win?.document;
  if (!doc || !win) {
    iframe.remove();
    throw new Error("Print frame unavailable");
  }
  doc.open();
  doc.write(html);
  doc.close();

  try {
    await ciRunPrintDiagnostics({
      correlationId: opts.metadata?.correlationId,
      surface: "focused_competition_analytics_pdf",
      doc,
      win,
    });
  } finally {
    window.setTimeout(() => iframe.remove(), 4000);
  }
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
        `<div class="kpi"><div class="kpi-label">${escapeHtml(k.label)}</div><div class="kpi-value">${escapeHtml(k.value)}</div></div>`
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
  const heads = opts.participantHeaders.map((h) => `<th>${escapeHtml(String(h))}</th>`).join("");
  const body = opts.participantRows
    .map(
      (r, ri) =>
        `<tr class="${ri % 2 === 1 ? "zebra" : ""}">${opts.participantHeaders
          .map((h) => `<td>${String(r[h] ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>`)
          .join("")}</tr>`
    )
    .join("");
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

  const coverInner = `
  <div class="wm">${wmText}</div>
  <div class="header"><img src="${headerImagePath}" alt="" /></div>
  <p class="cover-kicker">${safeDoc}</p>
  <h1 class="cover-title" dir="auto">${safeAct}</h1>
  <p class="cover-sub">${escapeHtml(opts.academicYearLine)}</p>
  <p class="cover-sub">${escapeHtml(opts.outcomeLine)}</p>
  <p class="meta">${escapeHtml(opts.isAr ? "تاريخ الإخراج" : "Generated")}: ${escapeHtml(now)}</p>
  <p class="cover-foot">${confFoot}</p>`;

  const execInner = `
  <div class="wm">${wmText}</div>
  <div class="header"><img src="${headerImagePath}" alt="" /></div>
  <h1 dir="auto" class="h1-sm">${safeAct}</h1>
  <p class="sub">${escapeHtml(opts.academicYearLine)} · ${escapeHtml(opts.outcomeLine)}</p>
  ${metaHtml}
  <div class="narr"><strong>${escapeHtml(opts.isAr ? "الملخص التنفيذي" : "Executive summary")}</strong><p>${nar}</p></div>
  <h2>${escapeHtml(opts.isAr ? "تنبيهات قرار" : "Decision alerts")}</h2>
  <div class="alerts"><ul>${alertBlock}</ul></div>
  <div class="kpi-grid">${kpiCards}</div>
  <div class="rec"><strong>${escapeHtml(opts.isAr ? "توصيات قواعدية" : "Rule-based recommendations")}</strong><ol>${recBlock}</ol></div>
  <p class="sign">${escapeHtml(opts.isAr ? "ختم / توقيع اعتماد اللجنة" : "Committee approval / signature")} _____________________</p>`;

  const chartsInner = `
  <div class="wm">${wmText}</div>
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
  <div class="wm">${wmText}</div>
  <h2>${escapeHtml(opts.isAr ? "مقارنة أداء الميداليات" : "Medal performance rates")}</h2>
  <table class="grid"><thead><tr><th>${escapeHtml(opts.isAr ? "المؤشر" : "Metric")}</th><th>${escapeHtml(opts.isAr ? "قيمة" : "Value")}</th></tr></thead><tbody>${medalTbody}</tbody></table>`;

  const benchInner = `
  <div class="wm">${wmText}</div>
  <h2>${escapeHtml(opts.isAr ? "معايير المقارنة المرجعية" : "Benchmark matrix")}</h2>
  <table class="grid"><thead><tr><th>${escapeHtml(opts.isAr ? "البعد" : "Dim")}</th><th>A</th><th>B</th></tr></thead><tbody>${benchTbody}</tbody></table>`;

  const rankInner = `
  <div class="wm">${wmText}</div>
  <h2>${escapeHtml(opts.isAr ? "تصنيف الأنشطة (أعلى اعتماد)" : "Activity ranking (approval rate)")}</h2>
  <table class="grid"><thead><tr><th>#</th><th>${escapeHtml(opts.isAr ? "نشاط" : "Activity")}</th><th>${escapeHtml(opts.isAr ? "اعتماد٪" : "Appr%")}</th><th>${escapeHtml(opts.isAr ? "م/100" : "M/100")}</th></tr></thead><tbody>${rankTbody}</tbody></table>`;

  const studentIntelInner =
    flags.studentIntel && studentIntelTbody ?
      `
  <div class="wm">${wmText}</div>
  <h2>${escapeHtml(opts.isAr ? "ذكاء الطلاب (مختصر)" : "Student intelligence (summary)")}</h2>
  <table class="grid"><thead><tr><th>${escapeHtml(opts.isAr ? "الطالب" : "Student")}</th><th>${escapeHtml(opts.isAr ? "سجلات" : "Rec")}</th><th>${escapeHtml(opts.isAr ? "ميداليات" : "Medals")}</th><th>${escapeHtml(opts.isAr ? "المرحلة" : "Stage")}</th></tr></thead><tbody>${studentIntelTbody}</tbody></table>`
    : "";

  const participantsInner = `
  <div class="wm">${wmText}</div>
  <h2>${escapeHtml(opts.isAr ? "ملحق المشاركين" : "Participants appendix")}</h2>
  ${cap}
  <table class="grid"><thead><tr>${heads}</tr></thead><tbody>${body}</tbody></table>`;

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
  const pagesHtml = sectionBodies
    .map(
      (inner, idx) => `
<div class="page ${idx > 0 ? "pb" : ""}">
  ${inner}
  <div class="page-foot"><span class="pnum">${escapeHtml(opts.isAr ? "صفحة" : "Page")} ${idx + 1} / ${total}</span><span class="conf">${confFoot}</span></div>
  <div class="brand-foot">${brandFoot}</div>
</div>`
    )
    .join("");

  const html = `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8" />
<title>${safeDoc}</title>
<style>
  @page { size: A4 landscape; margin: 12mm 14mm 16mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: Tahoma, "Segoe UI", Arial, sans-serif; margin: 0; color: #0f172a; font-size: 10px; line-height: 1.45; }
  .page { position: relative; padding: 10px 12px 28px; min-height: 180mm; break-inside: avoid; page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  .pb { page-break-before: always; }
  .wm { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 56px; font-weight: 900; color: #94a3b8; opacity: 0.06; transform: rotate(-28deg); pointer-events: none; z-index: 0; }
  .page > *:not(.wm) { position: relative; z-index: 1; }
  .header img { max-width: 100%; height: auto; margin-bottom: 8px; }
  h1 { font-size: 18px; font-weight: 800; margin: 0 0 6px 0; }
  .h1-sm { font-size: 16px; }
  .cover-kicker { font-size: 9px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #64748b; margin: 0 0 8px; }
  .cover-title { font-size: 26px; font-weight: 900; margin: 0 0 10px; line-height: 1.15; }
  .cover-sub { color: #475569; margin: 0 0 4px; font-size: 11px; }
  .cover-foot { margin-top: 24px; font-size: 9px; color: #64748b; font-weight: 700; border-top: 1px solid #e2e8f0; padding-top: 10px; }
  h2, h3 { break-after: avoid; page-break-after: avoid; orphans: 3; widows: 3; }
  thead { display: table-header-group; }
  tbody { display: table-row-group; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  .kpi { break-inside: avoid; page-break-inside: avoid; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; background: #fff; }
  .meta-block { margin: 8px 0 10px; break-inside: avoid; page-break-inside: avoid; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; background: #fff; }
  table.meta-grid { width: 100%; font-size: 8px; border-collapse: collapse; }
  table.meta-grid th, table.meta-grid td { border: 1px solid #e2e8f0; padding: 4px 6px; text-align: ${align}; vertical-align: top; }
  table.meta-grid th { width: 28%; background: #f1f5f9; color: #475569; font-weight: 700; }
  .sub { color: #475569; margin-bottom: 8px; }
  .meta { color: #64748b; font-size: 9px; margin-bottom: 10px; }
  .narr { border: 1px solid #e2e8f0; background: #f8fafc; padding: 10px; border-radius: 8px; margin-bottom: 10px; break-inside: avoid; }
  .alerts ul { margin: 0; padding: 0; list-style: none; }
  .alert-item { border-bottom: 1px solid #e2e8f0; padding: 6px 0; break-inside: avoid; }
  .alert-ic { margin-inline-end: 6px; }
  .rec { margin-top: 10px; break-inside: avoid; }
  .kpi-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; break-inside: avoid; }
  .kpi-label { font-size: 8px; color: #64748b; font-weight: 700; }
  .kpi-value { font-size: 14px; font-weight: 800; }
  table.grid { width: 100%; border-collapse: collapse; font-size: 9px; margin-top: 6px; table-layout: fixed; }
  table.fixed-chart { min-height: 120px; }
  table.grid th, table.grid td { border: 1px solid #cbd5e1; padding: 5px 6px; text-align: ${align}; word-wrap: break-word; }
  table.grid th { background: #e2e8f0; }
  table.grid thead { display: table-header-group; }
  table.grid tbody tr { break-inside: avoid; page-break-inside: avoid; }
  table.grid tbody tr.zebra td { background: #f8fafc; }
  .chart-block { break-inside: avoid; margin-bottom: 8px; }
  .pb-inside { page-break-inside: avoid; }
  .num { font-variant-numeric: tabular-nums; }
  .sign { margin-top: 12px; font-size: 9px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 8px; break-inside: avoid; }
  .capnote { color: #b45309; font-size: 9px; }
  .page-foot { position: absolute; left: 12px; right: 12px; bottom: 8px; display: flex; justify-content: space-between; align-items: center; font-size: 8px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 4px; }
  .page-foot .conf { font-weight: 700; color: #475569; }
  .brand-foot { position: absolute; left: 12px; right: 12px; bottom: 0; font-size: 7px; color: #94a3b8; text-align: center; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head><body>
${pagesHtml}
</body></html>`;

  const iframe2 = document.createElement("iframe");
  iframe2.style.cssText = "position:fixed;width:0;height:0;opacity:0;left:-9999px;pointer-events:none";
  document.body.appendChild(iframe2);
  const win2 = iframe2.contentWindow;
  const doc2 = win2?.document;
  if (!doc2 || !win2) {
    iframe2.remove();
    throw new Error("Print frame unavailable");
  }
  doc2.open();
  doc2.write(html);
  doc2.close();

  try {
    await ciRunPrintDiagnostics({
      correlationId: opts.metadata?.correlationId,
      surface: "focused_executive_report_pdf",
      doc: doc2,
      win: win2,
    });
  } finally {
    window.setTimeout(() => {
      iframe2.remove();
    }, 4000);
  }
};
