import {
  executivePdfPrintableWidthMm,
  type ExecutivePdfOrientation,
} from "@/lib/pdf/executive-pdf-theme";
import { escapeHtml } from "@/lib/pdf/executive-pdf-escape";

export type GenericColumnPlan = {
  header: string;
  widthMm: number;
  kind: "name" | "text" | "num" | "compact";
};

const MIN_COL_MM = 8;
const NAME_MIN_MM = 28;

const normalizeHeader = (h: string): string =>
  h
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u064B-\u065F]/g, "");

const inferColumnKind = (header: string): GenericColumnPlan["kind"] => {
  const n = normalizeHeader(header);
  if (/(اسم|name|student|طالب|learner)/.test(n)) return "name";
  if (/(سنة|year|score|درجة|عدد|count|نسب|٪|%|رقم|#)/.test(n)) return "num";
  if (/(جنس|قسم|موهبة|اعتماد|gender|section|mawhiba|approval)/.test(n)) return "compact";
  return "text";
};

const baseWidthForKind = (kind: GenericColumnPlan["kind"]): number => {
  if (kind === "name") return 42;
  if (kind === "num") return 12;
  if (kind === "compact") return 11;
  return 16;
};

/** Plan column widths for arbitrary register tables. */
export const planGenericTableColumns = (
  headers: string[],
  orientation: ExecutivePdfOrientation
): GenericColumnPlan[] => {
  const printable = executivePdfPrintableWidthMm(orientation);
  const kinds = headers.map((h) => inferColumnKind(h));
  let widths = kinds.map((k) => baseWidthForKind(k));
  const total = widths.reduce((a, b) => a + b, 0);

  if (total > printable) {
    const scale = printable / total;
    widths = widths.map((w, i) => Math.max(kinds[i] === "name" ? NAME_MIN_MM : MIN_COL_MM, w * scale));
  } else if (total < printable) {
    const slack = printable - total;
    const nameIdx = kinds.findIndex((k) => k === "name");
    if (nameIdx >= 0) widths[nameIdx] = (widths[nameIdx] ?? 16) + slack;
    else widths[0] = (widths[0] ?? 16) + slack;
  }

  return headers.map((header, i) => ({
    header,
    widthMm: Math.round((widths[i] ?? 12) * 10) / 10,
    kind: kinds[i]!,
  }));
};

/** Shrink columns proportionally when still overflowing printable width. */
export const shrinkColumnsToFit = (
  columns: GenericColumnPlan[],
  printableWidthMm: number
): GenericColumnPlan[] => {
  const total = columns.reduce((s, c) => s + c.widthMm, 0);
  if (total <= printableWidthMm) return columns;

  const scale = printableWidthMm / total;
  return columns.map((c) => ({
    ...c,
    widthMm: Math.max(c.kind === "name" ? NAME_MIN_MM : MIN_COL_MM, Math.round(c.widthMm * scale * 10) / 10),
  }));
};

export const clampCellText = (raw: string | number | null | undefined, maxChars = 120): string => {
  if (raw == null || raw === "") return "—";
  const s = String(raw);
  if (s.length <= maxChars) return escapeHtml(s);
  return `${escapeHtml(s.slice(0, maxChars - 1))}…`;
};

export const buildGenericTableColgroup = (columns: GenericColumnPlan[]): string =>
  `<colgroup>${columns.map((c) => `<col style="width:${c.widthMm}mm" />`).join("")}</colgroup>`;

export const buildGenericTableHtml = (opts: {
  headers: string[];
  rows: Array<Record<string, string | number | null | undefined>>;
  isAr: boolean;
  orientation: ExecutivePdfOrientation;
}): { html: string; tableWidthMm: number; columns: GenericColumnPlan[] } => {
  const planned = shrinkColumnsToFit(planGenericTableColumns(opts.headers, opts.orientation), executivePdfPrintableWidthMm(opts.orientation));
  const tableWidthMm = planned.reduce((s, c) => s + c.widthMm, 0);

  const thead = `<thead><tr>${planned
    .map((c) => {
      const cls = c.kind === "name" ? "ep-cell-name" : c.kind === "num" ? "ep-cell-num" : "ep-cell";
      return `<th scope="col" class="${cls}">${escapeHtml(c.header)}</th>`;
    })
    .join("")}</tr></thead>`;

  const tbody = opts.rows
    .map((row, ri) => {
      const zebra = ri % 2 === 1 ? " ep-row-alt" : "";
      const cells = planned
        .map((c) => {
          const cls =
            c.kind === "name" ? "ep-cell ep-cell-name"
            : c.kind === "num" ? "ep-cell ep-cell-num"
            : "ep-cell";
          const maxChars = c.kind === "name" ? 64 : 48;
          return `<td class="${cls}">${clampCellText(row[c.header], maxChars)}</td>`;
        })
        .join("");
      return `<tr class="ep-row${zebra}">${cells}</tr>`;
    })
    .join("");

  const html = `<table class="ep-grid" style="width:${tableWidthMm}mm" dir="${opts.isAr ? "rtl" : "ltr"}">
${buildGenericTableColgroup(planned)}
${thead}
<tbody>${tbody}</tbody>
</table>`;

  return { html, tableWidthMm, columns: planned };
};
