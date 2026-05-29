/**
 * Historical comparison table export — Excel with grouped headers + print HTML for PDF.
 */

import {
  columnKey,
  type HistoricalComparisonTableModel,
} from "@/lib/analytics/historical-comparison-table-engine";
import { resolveTableTheme } from "@/lib/analytics/analytics-table-theme-registry";
import {
  buildStableHistoricalColumnLayout,
  normalizeHistoricalValue,
} from "@/lib/analytics/analytics-table-value-normalizer";
import { buildSafeHistoricalModel } from "@/lib/analytics/analytics-historical-table-validator";
import { metricExportLabel } from "@/lib/analytics/analytics-metric-registry";
import { polishHistoricalTableModel } from "@/lib/analytics/historical-table-polish";
import type { HistoricalTableDisplayMode } from "@/lib/analytics/historical-executive-table-theme";
import type { TableExecutiveInsight } from "@/lib/analytics/historical-table-executive-enrichment";
import type {
  HistoricalEducationalIntelligence,
  TableIntelligenceOverlay,
} from "@/lib/analytics/historical-educational-intelligence";
import {
  composeExecutiveReportDocument,
  activityReportPage,
} from "@/lib/analytics/export/analytics-executive-report-layout";
import { openExecutiveReportPrintWindow } from "@/lib/analytics/export/analytics-pdf-page-composer";

const metricHeader = (metricKey: string, isAr: boolean): string => {
  const map: Record<string, Parameters<typeof metricExportLabel>[0]> = {
    participation: "participation_count",
    students: "unique_students",
    qualified: "qualified_students",
    nomination: "qualification_rate",
    award_winners: "award_winners",
    award_rate: "medal_conversion",
    rankings: "ranking_score",
    first_place: "ranking_score",
    finalists: "finalists",
    gold: "medal_conversion",
    silver: "medal_conversion",
    bronze: "medal_conversion",
    acceptance: "acceptance_rate",
    qualification_rate: "qualification_rate",
  };
  const id = map[metricKey];
  if (id) return metricExportLabel(id, isAr ? "ar" : "en");
  return metricKey;
};

const prepareExportModel = (
  model: HistoricalComparisonTableModel,
  displayMode: HistoricalTableDisplayMode = "executive"
): HistoricalComparisonTableModel =>
  polishHistoricalTableModel(buildSafeHistoricalModel(model), displayMode);

const flatHeaders = (model: HistoricalComparisonTableModel, isAr: boolean): string[] => {
  const layout = buildStableHistoricalColumnLayout(model);
  const rowLabel = isAr ? "اسم المسابقة" : "Category";
  const cols: string[] = [rowLabel];
  for (const col of layout.columns) {
    const metricLabel = metricHeader(col.metricKey, isAr);
    cols.push(
      isAr
        ? `${col.yearLabelAr} · ${metricLabel}`
        : `${col.yearLabelEn} · ${metricLabel}`
    );
  }
  return cols;
};

const flatRows = (
  model: HistoricalComparisonTableModel,
  isAr: boolean
): Array<Record<string, string | number>> => {
  const loc = isAr ? "ar" : "en";
  const layout = buildStableHistoricalColumnLayout(model);
  const headers = flatHeaders(model, isAr);
  const rowLabelKey = headers[0]!;
  return model.rows.map((row) => {
    const out: Record<string, string | number> = {
      [rowLabelKey]: isAr ? row.labelAr : row.labelEn,
    };
    for (const col of layout.columns) {
      const hk = isAr
        ? `${col.yearLabelAr} · ${col.metric.labelAr}`
        : `${col.yearLabelEn} · ${col.metric.labelEn}`;
      const raw = row.cells[col.columnKey];
      const normalized = normalizeHistoricalValue(raw, col.metricKey, {
        loc,
        isTotalRow: Boolean(row.isTotal),
        hasYear: true,
        explicitMissing: !Object.prototype.hasOwnProperty.call(row.cells, col.columnKey),
      });
      out[hk] = normalized.display;
    }
    return out;
  });
};

const intelligenceRowsForExport = (
  isAr: boolean,
  overlay: TableIntelligenceOverlay | undefined,
  intelligence: HistoricalEducationalIntelligence | undefined,
  rowLabelKey: string,
  tableInsights?: TableExecutiveInsight | null
): Array<Record<string, string | number>> => {
  const rows: Array<Record<string, string | number>> = [];
  if (tableInsights) {
    rows.push({
      [rowLabelKey]: isAr ? "— ملخص تنفيذي —" : "— Executive summary —",
    });
    for (const line of (isAr ? tableInsights.miniInsightsAr : tableInsights.miniInsightsEn).slice(
      0,
      5
    )) {
      rows.push({ [rowLabelKey]: line });
    }
    if (tableInsights.warningAr || tableInsights.warningEn) {
      rows.push({
        [rowLabelKey]: isAr
          ? (tableInsights.warningAr ?? "")
          : (tableInsights.warningEn ?? ""),
      });
    }
  }
  if (overlay) {
    rows.push({
      [rowLabelKey]: isAr ? "— ذكاء تاريخي —" : "— Historical intelligence —",
    });
    rows.push({
      [rowLabelKey]: isAr ? `CAGR: ${overlay.cagr}%` : `CAGR: ${overlay.cagr}%`,
    });
    rows.push({
      [rowLabelKey]: isAr
        ? `اتساق: ${overlay.consistencyScore}/100 · ذروة ${overlay.peakYear}`
        : `Consistency: ${overlay.consistencyScore}/100 · Peak ${overlay.peakYear}`,
    });
    rows.push({
      [rowLabelKey]: isAr
        ? `تقلب: ${overlay.volatility}%`
        : `Volatility: ${overlay.volatility}%`,
    });
  }
  if (intelligence) {
    for (const n of intelligence.narratives.slice(0, 4)) {
      rows.push({ [rowLabelKey]: isAr ? n.bodyAr : n.bodyEn });
    }
    if (intelligence.funnel) {
      rows.push({
        [rowLabelKey]: isAr ? intelligence.funnel.narrativeAr : intelligence.funnel.narrativeEn,
      });
    }
  }
  return rows;
};

export const exportHistoricalTableToExcel = async (
  model: HistoricalComparisonTableModel,
  isAr: boolean,
  filenameBase: string,
  intelligence?: HistoricalEducationalIntelligence,
  opts?: {
    displayMode?: HistoricalTableDisplayMode;
    tableInsights?: TableExecutiveInsight | null;
  }
): Promise<void> => {
  const XLSX = await import("xlsx");
  const safe = prepareExportModel(model, opts?.displayMode ?? "executive");
  const headers = flatHeaders(safe, isAr);
  const rows = flatRows(safe, isAr);
  const theme = resolveTableTheme(safe.themeId);

  const sheetRows: Array<Record<string, string | number>> = [];
  sheetRows.push({ [headers[0]!]: "إدارة مدارس الأنجال الأهلية" });
  sheetRows.push({
    [headers[0]!]: isAr ? safe.sectionTitleAr : safe.sectionTitleEn,
  });
  sheetRows.push({
    [headers[0]!]: isAr ? safe.activityLabelAr : safe.activityLabelEn,
  });
  const overlay = intelligence?.tableOverlays[safe.id];
  sheetRows.push(
    ...intelligenceRowsForExport(
      isAr,
      overlay,
      intelligence,
      headers[0]!,
      opts?.tableInsights
    )
  );
  sheetRows.push({});
  sheetRows.push(
    headers.reduce<Record<string, string>>((acc, h) => {
      acc[h] = h;
      return acc;
    }, {})
  );
  for (const r of rows) sheetRows.push(r);

  const ws = XLSX.utils.json_to_sheet(sheetRows, { skipHeader: true });
  ws["!rtl"] = isAr;

  if (ws["!ref"]) {
    const range = XLSX.utils.decode_range(ws["!ref"]);
    for (let R = range.s.r; R <= range.e.r; R += 1) {
      for (let C = range.s.c; C <= range.e.c; C += 1) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = ws[addr];
        if (!cell) continue;
        cell.s = {
          alignment: { horizontal: "center", vertical: "center", readingOrder: isAr ? 2 : 1 },
          border: {
            top: { style: "thin", color: { rgb: theme.borderColor.replace("#", "") } },
            bottom: { style: "thin", color: { rgb: theme.borderColor.replace("#", "") } },
            left: { style: "thin", color: { rgb: theme.borderColor.replace("#", "") } },
            right: { style: "thin", color: { rgb: theme.borderColor.replace("#", "") } },
          },
        };
      }
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, isAr ? "جدول تاريخي" : "Historical");
  XLSX.writeFile(wb, `${filenameBase}.xlsx`);
};

export const buildHistoricalTableExportFragment = (
  model: HistoricalComparisonTableModel,
  isAr: boolean,
  intelligence?: HistoricalEducationalIntelligence,
  opts?: {
    displayMode?: HistoricalTableDisplayMode;
    tableInsights?: TableExecutiveInsight | null;
  }
): { title: string; section: string; bodyHtml: string } => {
  const safe = prepareExportModel(model, opts?.displayMode ?? "executive");
  const layout = buildStableHistoricalColumnLayout(safe);
  const loc = isAr ? "ar" : "en";
  const theme = resolveTableTheme(safe.themeId);
  const title = isAr ? safe.activityLabelAr : safe.activityLabelEn;
  const section = isAr ? safe.sectionTitleAr : safe.sectionTitleEn;

  let headerRow1 = `<tr><th rowspan="2" style="background:${theme.rowLabelBg}">${isAr ? "اسم المسابقة" : "Category"}</th>`;
  let headerRow2 = "<tr>";
  for (const span of layout.yearHeaderSpans) {
    headerRow1 += `<th colspan="${span.colSpan}" style="background:${theme.headerYearBg};color:${theme.headerText}">${isAr ? span.labelAr : span.labelEn}</th>`;
  }
  headerRow1 += "</tr>";
  for (const col of layout.columns) {
    headerRow2 += `<th style="background:${theme.headerMetricBg}">${isAr ? col.metric.labelAr : col.metric.labelEn}</th>`;
  }
  headerRow2 += "</tr>";

  const bodyRows = safe.rows
    .map((row) => {
      const bg = row.isTotal ? theme.totalRowBg : theme.dataBg;
      let tr = `<tr style="background:${bg}"><td style="font-weight:bold">${isAr ? row.labelAr : row.labelEn}</td>`;
      for (const col of layout.columns) {
        const raw = row.cells[col.columnKey];
        const cell = normalizeHistoricalValue(raw, col.metricKey, {
          loc,
          isTotalRow: Boolean(row.isTotal),
          hasYear: true,
          explicitMissing: !Object.prototype.hasOwnProperty.call(row.cells, col.columnKey),
          hasParticipationScope: (row.cells[columnKey(col.year, "participation")] ?? 0) > 0,
          verifiedOutcomeSource: Boolean(safe.unifiedGraph?.signals?.hasMedals),
        });
        tr += `<td style="text-align:center">${cell.display}</td>`;
      }
      return `${tr}</tr>`;
    })
    .join("");

  const narratives = safe.narratives
    .slice(0, 3)
    .map((n) => `<li>${isAr ? n.bodyAr : n.bodyEn}</li>`)
    .join("");

  const overlay = intelligence?.tableOverlays[safe.id];
  const insights = opts?.tableInsights;
  const insightLines = insights
    ? (isAr ? insights.miniInsightsAr : insights.miniInsightsEn)
        .slice(0, 5)
        .map((l) => `<li>${l}</li>`)
        .join("")
    : "";
  const intelBlock =
    overlay || insights
      ? `<div style="margin-bottom:12px;padding:8px;background:#f0f4ff;border:1px solid #c7d2fe;border-radius:6px;font-size:10px">
        <strong>${isAr ? "ذكاء تنفيذي" : "Executive intelligence"}</strong>
        ${
          overlay
            ? `<p>CAGR: ${overlay.cagr}% · ${isAr ? "اتساق" : "Consistency"}: ${overlay.consistencyScore}/100 · ${isAr ? "ذروة" : "Peak"}: ${overlay.peakYear} · σ: ${overlay.volatility}</p>`
            : ""
        }
        ${insightLines ? `<ul>${insightLines}</ul>` : ""}
      </div>`
      : "";

  const execNarratives = (intelligence?.narratives ?? [])
    .slice(0, 4)
    .map((n) => `<li>${isAr ? n.bodyAr : n.bodyEn}</li>`)
    .join("");

  const bodyHtml = `${intelBlock}
  ${narratives ? `<ul>${narratives}</ul>` : ""}
  ${execNarratives ? `<ul style="color:#334155">${execNarratives}</ul>` : ""}
  <table><thead>${headerRow1}${headerRow2}</thead><tbody>${bodyRows}</tbody></table>`;

  return { title, section, bodyHtml };
};

export const buildHistoricalTablePrintHtml = (
  model: HistoricalComparisonTableModel,
  isAr: boolean,
  intelligence?: HistoricalEducationalIntelligence,
  opts?: {
    displayMode?: HistoricalTableDisplayMode;
    tableInsights?: TableExecutiveInsight | null;
  }
): string => {
  const dir = isAr ? "rtl" : "ltr";
  const { title, section, bodyHtml } = buildHistoricalTableExportFragment(
    model,
    isAr,
    intelligence,
    opts
  );
  const safe = prepareExportModel(model, opts?.displayMode ?? "executive");
  const theme = resolveTableTheme(safe.themeId);

  return `<!DOCTYPE html><html dir="${dir}" lang="${isAr ? "ar" : "en"}"><head><meta charset="utf-8"/><style>
    @page { size: landscape; margin: 12mm; }
    body { font-family: Tahoma, Arial, sans-serif; font-size: 11px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid ${theme.borderColor}; padding: 4px 6px; }
    h1 { font-size: 14px; margin: 0 0 8px; }
    h2 { font-size: 12px; margin: 0 0 12px; color: #444; }
  </style></head><body>
  <h1>${title}</h1>
  <h2>${section}</h2>
  ${bodyHtml}
  </body></html>`;
};

export const printHistoricalTablePdf = (
  model: HistoricalComparisonTableModel,
  isAr: boolean,
  intelligence?: HistoricalEducationalIntelligence,
  opts?: {
    displayMode?: HistoricalTableDisplayMode;
    tableInsights?: TableExecutiveInsight | null;
  }
): void => {
  const safe = prepareExportModel(model, opts?.displayMode ?? "executive");
  const { title, section, bodyHtml } = buildHistoricalTableExportFragment(
    model,
    isAr,
    intelligence,
    opts
  );
  const doc = composeExecutiveReportDocument({
    isAr,
    title,
    subtitle: section,
    generatedAt: new Date().toLocaleDateString(isAr ? "ar-SA" : "en-GB"),
    yearsLabel: safe.yearGroups.map((g) => g.year).join(" · "),
    activityLabel: title,
    sections: [
      {
        id: "historical",
        titleAr: "الذكاء التاريخي",
        titleEn: "Historical Intelligence",
        html: activityReportPage({
          isAr,
          activityLabel: title,
          yearLabel: safe.yearGroups.map((g) => g.year).join(" · "),
          tableHtml: bodyHtml,
        }),
        landscape: true,
      },
    ],
  });
  void import("@/lib/pdf/executive-pdf-governance").then(({ exportGovernedExecutiveReport }) => {
    void exportGovernedExecutiveReport("historical-comparison", {
      html: doc,
      rowCount: safe.rows?.length ?? safe.yearGroups.length * 10,
      columnCount: Math.max(safe.yearGroups.length * 4, 8),
    });
  });
};
