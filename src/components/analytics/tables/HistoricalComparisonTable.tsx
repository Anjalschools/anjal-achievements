"use client";

import { useCallback, useMemo } from "react";
import type { HistoricalComparisonTableModel } from "@/lib/analytics/historical-comparison-table-engine";
import { resolveTableTheme } from "@/lib/analytics/analytics-table-theme-registry";
import { useStableHistoricalTableModel } from "@/hooks/useStableHistoricalTableModel";
import { isDrillPayloadValid } from "@/lib/analytics/analytics-historical-table-validator";
import HistoricalEmptyStateCard from "@/components/analytics/tables/HistoricalEmptyStateCard";
import { useClientMounted } from "@/hooks/useClientMounted";
import type { TableIntelligenceOverlay } from "@/lib/analytics/historical-educational-intelligence";
import { formatPercentage } from "@/lib/analytics/analytics-number-formatting";
import {
  resolveExecutiveTableTheme,
  metricHeaderStyle,
  cellHighlightStyle,
  type HistoricalTableDisplayMode,
} from "@/lib/analytics/historical-executive-table-theme";
import {
  buildExecutiveCellHighlights,
  yearColumnBadge,
  type CellHighlightMap,
} from "@/lib/analytics/historical-executive-highlighting";
import type { TableExecutiveInsight } from "@/lib/analytics/historical-table-executive-enrichment";

export type HistoricalComparisonTableProps = {
  isAr: boolean;
  model: HistoricalComparisonTableModel;
  intelligenceOverlay?: TableIntelligenceOverlay | null;
  tableInsights?: TableExecutiveInsight | null;
  displayMode?: HistoricalTableDisplayMode;
  compact?: boolean;
  requestedYears?: number[];
  filterSummaryAr?: string;
  filterSummaryEn?: string;
  onResetFilters?: () => void;
  onDrill?: (payload: {
    year: number;
    metricKey: string;
    rowKey: string;
    activityFamilyKey: string;
    value: number;
  }) => void;
};

const trendChipClass = (dir: "up" | "down" | "stable"): string => {
  if (dir === "up") return "bg-emerald-100 text-emerald-800";
  if (dir === "down") return "bg-rose-100 text-rose-800";
  return "bg-slate-100 text-slate-700";
};

const metricHeaderClass = (metricKey: string): string => {
  if (metricKey === "gold") return "bg-amber-50 text-amber-900";
  if (metricKey === "silver") return "bg-slate-100 text-slate-800";
  if (metricKey === "bronze") return "bg-orange-50 text-orange-900";
  if (metricKey === "participation") return "bg-slate-50 text-slate-700";
  if (metricKey.includes("rate")) return "bg-violet-50 text-violet-900";
  if (metricKey === "nomination" || metricKey === "acceptance") return "bg-sky-50 text-sky-900";
  return "bg-white text-slate-700";
};

const metricCellClass = (metricKey: string, isTotal: boolean): string => {
  if (isTotal) return "font-black";
  if (metricKey === "gold") return "bg-amber-50/40";
  if (metricKey === "silver") return "bg-slate-50/60";
  if (metricKey === "bronze") return "bg-orange-50/40";
  if (metricKey.includes("rate")) return "bg-violet-50/30 font-semibold text-violet-900";
  return "";
};

const overlayBadgeClass = (semantic: TableIntelligenceOverlay["semantic"]): string => {
  if (semantic === "accelerating" || semantic === "recovery") return "bg-emerald-100 text-emerald-800";
  if (semantic === "declining") return "bg-rose-100 text-rose-800";
  if (semantic === "volatile") return "bg-amber-100 text-amber-900";
  return "bg-slate-100 text-slate-700";
};

const HistoricalComparisonTable = ({
  isAr,
  model,
  intelligenceOverlay,
  tableInsights,
  displayMode = "executive",
  compact = false,
  requestedYears,
  filterSummaryAr,
  filterSummaryEn,
  onResetFilters,
  onDrill,
}: HistoricalComparisonTableProps) => {
  const loc = isAr ? "ar" : "en";
  const mounted = useClientMounted();
  const stable = useStableHistoricalTableModel(model, loc);
  const theme = useMemo(() => resolveTableTheme(model.themeId), [model.themeId]);
  const execTheme = useMemo(() => resolveExecutiveTableTheme(displayMode), [displayMode]);
  const highlights: CellHighlightMap = useMemo(
    () => buildExecutiveCellHighlights(model),
    [model]
  );

  const handleCellClick = useCallback(
    (rowKey: string, year: number, metricKey: string, value: number) => {
      const payload = { year, metricKey, rowKey, activityFamilyKey: model.activityFamilyKey, value };
      if (!onDrill || !isDrillPayloadValid(payload)) return;
      onDrill(payload);
    },
    [onDrill, model.activityFamilyKey]
  );

  if (!stable || !stable.validation.canRender) {
    return (
      <HistoricalEmptyStateCard
        isAr={isAr}
        reasonAr="لا توجد بيانات تاريخية كافية لعرض الجدول ضمن الفلاتر الحالية"
        reasonEn="Not enough historical data to render this table with current filters"
        requestedYears={requestedYears ?? stable?.model.yearGroups.map((g) => g.year)}
        filterSummaryAr={filterSummaryAr}
        filterSummaryEn={filterSummaryEn}
        suggestionsAr={[
          "وسّع نطاق السنوات المحددة",
          "جرّب بعدًا مجمّعًا (بنين وبنات)",
          "اختر نشاطًا آخر من القائمة",
        ]}
        suggestionsEn={[
          "Expand the selected year range",
          "Try the combined boys & girls dimension",
          "Pick another activity family",
        ]}
        onResetFilters={onResetFilters}
        validation={stable?.validation}
      />
    );
  }

  const { layout, rows, validation, trendsEligible, insufficientTrendLabelAr, insufficientTrendLabelEn } =
    stable;

  const tableMinWidth = layout.labelColumnWidthPx + layout.columns.length * layout.yearColumnMinWidthPx;

  return (
    <div className="space-y-3" dir={isAr ? "rtl" : "ltr"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-black text-slate-900">
            {isAr ? model.activityLabelAr : model.activityLabelEn}
          </h4>
          <p className="text-[10px] text-slate-500">
            {isAr ? model.sectionTitleAr : model.sectionTitleEn}
          </p>
          {model.outcomeGap?.messageAr || model.outcomeGap?.messageEn ? (
            <p
              className="mt-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[9px] font-medium text-amber-900"
              role="status"
            >
              {isAr ? model.outcomeGap.messageAr : model.outcomeGap.messageEn}
            </p>
          ) : null}
        </div>
        {tableInsights ? (
          <ul className="flex flex-wrap gap-1">
            {(isAr ? tableInsights.miniInsightsAr : tableInsights.miniInsightsEn)
              .slice(0, displayMode === "executive" ? 3 : 5)
              .map((line, i) => (
                <li
                  key={`ins-${i}`}
                  className="rounded-md border border-indigo-100 bg-indigo-50/60 px-2 py-0.5 text-[9px] font-medium text-indigo-950"
                >
                  {line}
                </li>
              ))}
            {tableInsights.warningAr && isAr ? (
              <li className="rounded-md bg-rose-50 px-2 py-0.5 text-[9px] font-bold text-rose-800">
                {tableInsights.warningAr}
              </li>
            ) : null}
            {tableInsights.warningEn && !isAr ? (
              <li className="rounded-md bg-rose-50 px-2 py-0.5 text-[9px] font-bold text-rose-800">
                {tableInsights.warningEn}
              </li>
            ) : null}
          </ul>
        ) : null}
        <div className="flex flex-wrap items-center gap-1">
          {intelligenceOverlay ? (
            <>
              <span
                className={`rounded-md px-2 py-0.5 text-[9px] font-bold ${overlayBadgeClass(intelligenceOverlay.semantic)}`}
              >
                CAGR {formatPercentage(intelligenceOverlay.cagr, loc)}
              </span>
              <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-[9px] font-bold text-indigo-900">
                {isAr ? "اتساق" : "Consistency"} {intelligenceOverlay.consistencyScore}
              </span>
              <span className="rounded-md bg-violet-100 px-2 py-0.5 text-[9px] font-bold text-violet-900">
                {isAr ? "ذروة" : "Peak"} {intelligenceOverlay.peakYear}
              </span>
              {intelligenceOverlay.volatility > 40 ? (
                <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-900">
                  σ {intelligenceOverlay.volatility}
                </span>
              ) : null}
            </>
          ) : trendsEligible && model.trends.length > 0 ? (
            model.trends.slice(0, compact ? 2 : 4).map((t) => (
              <span
                key={t.id}
                className={`rounded-md px-2 py-0.5 text-[9px] font-bold ${trendChipClass(t.direction)}`}
              >
                {isAr ? t.labelAr : t.labelEn}
              </span>
            ))
          ) : (
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-600">
              {isAr ? insufficientTrendLabelAr : insufficientTrendLabelEn}
            </span>
          )}
        </div>
      </div>

      {model.narratives.length > 0 && !compact ? (
        <ul className="grid gap-1 sm:grid-cols-2">
          {model.narratives.slice(0, 3).map((n) => (
            <li
              key={n.id}
              className="rounded-lg border border-indigo-100 bg-indigo-50/40 px-2 py-1.5 text-[10px] text-slate-800"
            >
              {isAr ? n.bodyAr : n.bodyEn}
            </li>
          ))}
        </ul>
      ) : null}

      <div
        className="analytics-historical-table-scroll overflow-x-auto rounded-xl border-2 shadow-sm print:overflow-visible"
        style={{ borderColor: theme.borderColor, WebkitOverflowScrolling: "touch" }}
      >
        <table
          className="w-full border-collapse text-center text-xs print:table-fixed"
          style={{
            tableLayout: "fixed",
            minWidth: mounted ? tableMinWidth : tableMinWidth,
          }}
        >
          <colgroup>
            <col style={{ width: layout.labelColumnWidthPx, minWidth: layout.labelColumnWidthPx }} />
            {layout.columns.map((col) => (
              <col
                key={col.columnKey}
                style={{ width: col.minWidthPx, minWidth: col.minWidthPx }}
              />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-20">
            <tr>
              <th
                rowSpan={layout.headerDepth}
                className="sticky z-30 border px-2 py-2 text-start text-[11px] font-black shadow-[2px_0_4px_rgba(0,0,0,0.06)]"
                style={{
                  background: theme.rowLabelBg,
                  borderColor: theme.borderColor,
                  insetInlineStart: 0,
                  width: layout.labelColumnWidthPx,
                  minWidth: layout.labelColumnWidthPx,
                }}
              >
                {isAr ? "اسم المسابقة" : "Category"}
              </th>
              {layout.yearHeaderSpans.map((span, yi) => (
                <th
                  key={span.year}
                  colSpan={span.colSpan}
                  className={`border px-2 py-2 font-black ${yi > 0 ? "border-s-2 border-s-indigo-200" : ""}`}
                  style={{
                    background: theme.headerYearBg,
                    color: theme.headerText,
                    borderColor: theme.borderColor,
                  }}
                >
                  <span className="inline-flex items-center gap-1">
                  {isAr ? span.labelAr : span.labelEn}
                  {yearColumnBadge(span.year, highlights, model, isAr) ? (
                    <span className="rounded bg-emerald-100 px-1 text-[8px] font-bold text-emerald-800">
                      {yearColumnBadge(span.year, highlights, model, isAr)}
                    </span>
                  ) : null}
                </span>
                </th>
              ))}
            </tr>
            <tr>
              {layout.columns.map((col, ci) => {
                const yearBreak =
                  ci > 0 && layout.columns[ci - 1]?.year !== col.year;
                return (
                  <th
                    key={col.columnKey}
                    className={`border px-1 py-1.5 text-[10px] font-bold ${yearBreak ? "border-s-2 border-s-indigo-100" : ""}`}
                    style={{
                      borderColor: execTheme.borderColor,
                      ...metricHeaderStyle(col.metricKey, execTheme),
                    }}
                  >
                    {isAr ? col.metric.labelAr : col.metric.labelEn}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr
                key={row.key}
                className={row.isTotal ? "font-black" : ""}
                style={{
                  background: row.isTotal
                    ? theme.totalRowBg
                    : ri % 2 === 0
                      ? theme.dataBg
                      : theme.dataAltBg,
                }}
              >
                <td
                  className="sticky z-10 border px-2 py-1.5 text-start text-[11px] font-bold shadow-[2px_0_4px_rgba(0,0,0,0.04)]"
                  style={{
                    borderColor: theme.borderColor,
                    background: row.isTotal ? theme.totalRowBg : theme.rowLabelBg,
                    insetInlineStart: 0,
                    width: layout.labelColumnWidthPx,
                  }}
                >
                  <span className="block truncate" title={isAr ? row.labelAr : row.labelEn}>
                    {isAr ? row.labelAr : row.labelEn}
                  </span>
                </td>
                {layout.columns.map((col, ci) => {
                  const cell = row.cells[col.columnKey]!;
                  const clickable =
                    mounted &&
                    onDrill &&
                    !row.isTotal &&
                    !cell.isMissing &&
                    cell.numeric > 0;
                  const yearBreak =
                    ci > 0 && layout.columns[ci - 1]?.year !== col.year;
                  const hl = highlights[col.columnKey] ?? null;
                  const hlStyle = cellHighlightStyle(hl);
                  return (
                    <td
                      key={`${row.key}-${col.columnKey}`}
                      className={`border px-1 py-1.5 tabular-nums ${metricCellClass(col.metricKey, Boolean(row.isTotal))} ${
                        clickable ? "cursor-pointer hover:bg-indigo-50 hover:ring-1 hover:ring-indigo-300" : ""
                      } ${cell.isEmpty && !row.isTotal ? "text-slate-400" : "text-slate-900"} ${
                        yearBreak ? "border-s-2 border-s-indigo-50" : ""
                      }`}
                      title={
                        cell.tooltipAr && isAr
                          ? cell.tooltipAr
                          : cell.tooltipEn && !isAr
                            ? cell.tooltipEn
                            : undefined
                      }
                      style={{
                        borderColor: execTheme.borderColor,
                        height: displayMode === "compact" ? 28 : 32,
                        ...hlStyle,
                      }}
                      onClick={
                        clickable
                          ? () =>
                              handleCellClick(row.key, col.year, col.metricKey, cell.numeric)
                          : undefined
                      }
                      onKeyDown={
                        clickable
                          ? (e) => {
                              if (e.key === "Enter") {
                                handleCellClick(row.key, col.year, col.metricKey, cell.numeric);
                              }
                            }
                          : undefined
                      }
                      tabIndex={clickable ? 0 : undefined}
                      role={clickable ? "button" : undefined}
                      aria-label={
                        clickable
                          ? `${isAr ? row.labelAr : row.labelEn} ${col.year} ${col.metricKey}`
                          : undefined
                      }
                    >
                      <span className="block truncate">{cell.display}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!validation.valid || !model.totals.valid ? (
        <p className="text-[10px] text-amber-700">
          {isAr ? "تنبيه: المجاميع تحتاج مراجعة" : "Note: totals require review"}
        </p>
      ) : null}
    </div>
  );
};

export default HistoricalComparisonTable;
