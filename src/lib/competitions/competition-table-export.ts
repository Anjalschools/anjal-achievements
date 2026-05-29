import type { CompetitionTableModel } from "@/lib/analytics/competition-table-engine";
import { competitionTableColumnKey } from "@/lib/analytics/competition-table-engine";
import {
  buildCompetitionTablePrintHtml,
  openCompetitionTablePrintWindow,
  type CompetitionTablePdfMetadata,
} from "@/lib/competitions/export/competition-pdf-document";

export type { CompetitionTablePdfMetadata };
export { buildCompetitionTablePrintHtml };

export const printCompetitionTablePdf = (
  model: CompetitionTableModel,
  isAr: boolean,
  meta?: CompetitionTablePdfMetadata
) => {
  openCompetitionTablePrintWindow(buildCompetitionTablePrintHtml(model, isAr, meta));
};

export const exportCompetitionTableExcel = async (model: CompetitionTableModel, isAr: boolean) => {
  const XLSX = await import("xlsx");
  const title = isAr ? model.competitionTitleAr : model.competitionTitleEn;
  const headerRow: string[] = [isAr ? "المرحلة" : "Stage"];
  for (const yg of model.yearGroups) {
    for (const col of yg.columns) {
      headerRow.push(`${yg.year} — ${isAr ? col.labelAr : col.labelEn}`);
    }
  }
  const aoa: (string | number)[][] = [[title], headerRow];
  for (const row of model.rows) {
    const line: (string | number)[] = [isAr ? row.labelAr : row.labelEn];
    for (const yg of model.yearGroups) {
      for (const col of yg.columns) {
        line.push(row.cells[competitionTableColumnKey(yg.year, col.key)] ?? 0);
      }
    }
    aoa.push(line);
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  if (isAr) ws["!views"] = [{ rightToLeft: true }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "competition-stats");
  const arr = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([arr], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${model.competition}-statistics.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};
