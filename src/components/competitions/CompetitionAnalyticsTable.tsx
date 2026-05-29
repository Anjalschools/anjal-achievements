"use client";

import { memo, useMemo } from "react";
import type { CompetitionTableModel } from "@/lib/analytics/competition-table-engine";
import { competitionTableColumnKey } from "@/lib/analytics/competition-table-engine";

export type CompetitionAnalyticsTableProps = {
  isAr: boolean;
  model: CompetitionTableModel;
  sectionTitle?: string;
  compact?: boolean;
};

const CompetitionAnalyticsTable = memo(({ isAr, model, sectionTitle, compact }: CompetitionAnalyticsTableProps) => {
  const peakCells = useMemo(() => {
    const peaks = new Set<string>();
    for (const yg of model.yearGroups) {
      for (const col of yg.columns) {
        if (col.key === "total") continue;
        const ck = competitionTableColumnKey(yg.year, col.key);
        let max = 0;
        let maxRow = "";
        for (const row of model.rows) {
          if (row.isTotal) continue;
          const v = row.cells[ck] ?? 0;
          if (v > max) {
            max = v;
            maxRow = row.key;
          }
        }
        if (maxRow) peaks.add(`${ck}:${maxRow}`);
      }
    }
    return peaks;
  }, [model]);

  const title =
    sectionTitle ?? (isAr ? "قسم البنين والبنات" : "Boys and girls section");

  return (
    <div
      className="overflow-x-auto rounded-2xl border-2 border-slate-900 bg-white shadow-md print:shadow-none"
      dir={isAr ? "rtl" : "ltr"}
    >
      <div className="border-b-2 border-slate-900 bg-sky-100 px-4 py-2 text-center text-sm font-black text-slate-900">
        {isAr ? model.competitionTitleAr : model.competitionTitleEn}
        <span className="mx-2 font-normal text-slate-600">—</span>
        {title}
      </div>
      <table className="w-full min-w-[720px] border-collapse text-xs">
        <thead>
          <tr>
            <th
              rowSpan={2}
              className="sticky right-0 z-10 min-w-[120px] border-2 border-slate-900 bg-sky-100 px-3 py-2 text-center font-black"
            >
              {isAr ? "المرحلة" : "Stage"}
            </th>
            {model.yearGroups.map((yg) => (
              <th
                key={yg.year}
                colSpan={yg.columns.length}
                className="border-2 border-slate-900 bg-sky-100 px-2 py-2 text-center font-black text-slate-900"
              >
                {isAr ? yg.labelAr : yg.labelEn}
              </th>
            ))}
          </tr>
          <tr>
            {model.yearGroups.map((yg) =>
              yg.columns.map((col) => (
                <th key={`${yg.year}-${col.key}`} className={`px-2 py-1.5 text-center ${col.headerClass}`}>
                  {isAr ? col.labelAr : col.labelEn}
                </th>
              ))
            )}
          </tr>
        </thead>
        <tbody>
          {model.rows.map((row) => (
            <tr
              key={row.key}
              className={row.isTotal ? "bg-orange-100 font-black" : "hover:bg-slate-50/80"}
            >
              <td
                className={`sticky right-0 z-10 border border-slate-900 px-3 py-2 text-center ${
                  row.isTotal ? "bg-orange-100 font-black" : "bg-sky-50 font-semibold"
                }`}
              >
                {isAr ? row.labelAr : row.labelEn}
              </td>
              {model.yearGroups.map((yg) =>
                yg.columns.map((col) => {
                  const ck = competitionTableColumnKey(yg.year, col.key);
                  const value = row.cells[ck] ?? 0;
                  const isPeak = peakCells.has(`${ck}:${row.key}`);
                  return (
                    <td
                      key={ck}
                      className={`border border-slate-900 px-2 py-1.5 tabular-nums ${col.cellClass} ${
                        row.isTotal ? "!bg-orange-100 font-black" : ""
                      } ${isPeak ? "ring-2 ring-inset ring-indigo-400" : ""} ${compact ? "py-1" : ""}`}
                    >
                      {value > 0 ? value : "—"}
                    </td>
                  );
                })
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

CompetitionAnalyticsTable.displayName = "CompetitionAnalyticsTable";
export default CompetitionAnalyticsTable;
