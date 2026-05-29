"use client";

import { memo, useMemo } from "react";
import type { MatrixTableModel } from "@/lib/analytics/shared/historical-matrix-types";
import { resolveTableTheme } from "@/lib/analytics/analytics-table-theme-registry";
import { formatLocalizedNumber } from "@/lib/analytics/analytics-number-formatting";
import HistoricalMatrixEmptyState from "@/components/analytics/tables/HistoricalMatrixEmptyState";
import MatrixRecoveryBanner from "@/components/analytics/MatrixRecoveryBanner";
import type { MatrixDebugMeta } from "@/lib/analytics/historical-matrix-model";
import { validateMatrixMeasures } from "@/lib/analytics/historical-matrix-model";

export type EducationalMatrixTableProps = {
  isAr: boolean;
  model: MatrixTableModel | null;
  meta?: MatrixDebugMeta;
  titleAr?: string;
  titleEn?: string;
};

const EducationalMatrixTable = ({
  isAr,
  model,
  meta,
  titleAr = "مصفوفة المقارنة",
  titleEn = "Comparison matrix",
}: EducationalMatrixTableProps) => {
  const theme = resolveTableTheme("executive");
  const loc = isAr ? "ar" : "en";

  const validation = useMemo(
    () => (model ? validateMatrixMeasures(model) : { valid: false, normalizedRows: 0 }),
    [model]
  );

  if (!model || !validation.valid) {
    if (meta?.recoveryMode) {
      return (
        <div className="space-y-2">
          <MatrixRecoveryBanner isAr={isAr} meta={meta} />
          <HistoricalMatrixEmptyState isAr={isAr} meta={meta} partialSignal />
        </div>
      );
    }
    return <HistoricalMatrixEmptyState isAr={isAr} meta={meta} />;
  }

  const rowLabels = model.rowLabels;
  const columnLabels = model.columnLabels;

  return (
    <div className="space-y-2" dir={isAr ? "rtl" : "ltr"}>
      <MatrixRecoveryBanner isAr={isAr} meta={meta} />
      <h4 className="text-xs font-black text-slate-900">{isAr ? titleAr : titleEn}</h4>
      <div
        className="overflow-x-auto rounded-xl border"
        style={{ borderColor: theme.borderColor, tableLayout: "fixed" }}
      >
        <table className="w-full min-w-[480px] border-collapse text-center text-xs">
          <thead>
            <tr style={{ background: theme.headerYearBg, color: theme.headerText }}>
              <th
                className="sticky z-10 border px-2 py-2 text-start"
                style={{ borderColor: theme.borderColor, background: theme.rowLabelBg }}
              >
                {isAr ? "الصف / المرحلة" : "Grade / stage"}
              </th>
              {columnLabels.map((c) => (
                <th
                  key={`col-h-${c.key}`}
                  className="border px-2 py-2 min-w-[72px]"
                  style={{ borderColor: theme.borderColor }}
                >
                  {isAr ? c.labelAr : c.labelEn}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowLabels.map((row, i) => (
              <tr
                key={`row-${row.key}`}
                style={{ background: i % 2 === 0 ? theme.dataBg : theme.dataAltBg }}
              >
                <td
                  className="sticky z-10 border px-2 py-1.5 text-start font-bold"
                  style={{ background: theme.rowLabelBg, borderColor: theme.borderColor }}
                >
                  {isAr ? row.labelAr : row.labelEn}
                </td>
                {columnLabels.map((col) => {
                  const raw = model.cells[row.key]?.[col.key];
                  const n = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
                  return (
                    <td
                      key={`cell-${row.key}-${col.key}`}
                      className="border px-2 py-1.5 tabular-nums"
                      style={{ borderColor: theme.borderColor }}
                    >
                      {n > 0 ? formatLocalizedNumber(n, loc, 0) : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default memo(EducationalMatrixTable);
