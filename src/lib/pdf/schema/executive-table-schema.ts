import {
  executivePrintableWidthMm,
  type ExecutivePdfOrientation,
} from "@/lib/pdf/tokens/executive-print";
import { escapeHtml } from "@/lib/pdf/executive-pdf-escape";

export type ExecutiveColumnShrink = "none" | "proportional" | "priority";
export type ExecutiveColumnAlign = "start" | "center" | "end";
export type ExecutiveColumnKind = "name" | "text" | "num" | "compact";

export type ExecutiveTableColumn = {
  id: string;
  header: string;
  printableWidthMm: number;
  priority: number;
  shrink: ExecutiveColumnShrink;
  clampChars: number;
  align: ExecutiveColumnAlign;
  kind: ExecutiveColumnKind;
  numeric?: boolean;
  landscapeMinMm?: number;
};

export type ExecutiveTableSchema = {
  id: string;
  caption?: string;
  columns: ExecutiveTableColumn[];
};

export type ExecutiveTableRow = Record<string, string | number | null | undefined>;

const MIN_COL_MM = 8;
const NAME_MIN_MM = 28;

export const shrinkSchemaColumnsToFit = (
  schema: ExecutiveTableSchema,
  orientation: ExecutivePdfOrientation
): ExecutiveTableColumn[] => {
  const printable = executivePrintableWidthMm(orientation);
  const total = schema.columns.reduce((s, c) => s + c.printableWidthMm, 0);
  if (total <= printable) return schema.columns;

  const scale = printable / total;
  return schema.columns.map((c) => ({
    ...c,
    printableWidthMm: Math.max(
      c.kind === "name" ? (c.landscapeMinMm ?? NAME_MIN_MM) : MIN_COL_MM,
      Math.round(c.printableWidthMm * scale * 10) / 10
    ),
  }));
};

const cellClass = (kind: ExecutiveColumnKind): string => {
  if (kind === "name") return "ep-cell ep-cell-name";
  if (kind === "num") return "ep-cell ep-cell-num";
  return "ep-cell";
};

const clampCell = (raw: string | number | null | undefined, max: number): string => {
  if (raw == null || raw === "") return "—";
  const s = String(raw);
  if (s.length <= max) return escapeHtml(s);
  return `${escapeHtml(s.slice(0, max - 1))}…`;
};

export const buildTableFromSchema = (opts: {
  schema: ExecutiveTableSchema;
  rows: ExecutiveTableRow[];
  isAr: boolean;
  orientation: ExecutivePdfOrientation;
}): { html: string; tableWidthMm: number; columns: ExecutiveTableColumn[] } => {
  const columns = shrinkSchemaColumnsToFit(opts.schema, opts.orientation);
  const tableWidthMm = columns.reduce((s, c) => s + c.printableWidthMm, 0);
  const align = opts.isAr ? "right" : "left";

  const colgroup = `<colgroup>${columns
    .map((c) => `<col style="width:${c.printableWidthMm}mm" />`)
    .join("")}</colgroup>`;

  const caption = opts.schema.caption
    ? `<caption class="ep-sr-caption">${escapeHtml(opts.schema.caption)}</caption>`
    : "";

  const thead = `<thead><tr>${columns
    .map(
      (c) =>
        `<th scope="col" class="${cellClass(c.kind)}" style="text-align:${c.align === "center" ? "center" : align}">${escapeHtml(c.header)}</th>`
    )
    .join("")}</tr></thead>`;

  const tbody = opts.rows
    .map((row, ri) => {
      const zebra = ri % 2 === 1 ? " ep-row-alt" : "";
      const cells = columns
        .map((c) => `<td class="${cellClass(c.kind)}">${clampCell(row[c.id], c.clampChars)}</td>`)
        .join("");
      return `<tr class="ep-row${zebra}">${cells}</tr>`;
    })
    .join("");

  const html = `<table class="ep-grid" style="width:${tableWidthMm}mm" dir="${opts.isAr ? "rtl" : "ltr"}" role="table">
${colgroup}
${caption}
${thead}
<tbody>${tbody}</tbody>
</table>`;

  return { html, tableWidthMm, columns };
};

/** Infer schema from header labels (governance-approved path for legacy callers). */
export const schemaFromHeaders = (
  id: string,
  headers: string[],
  orientation: ExecutivePdfOrientation
): ExecutiveTableSchema => {
  const printable = executivePrintableWidthMm(orientation);
  const base = headers.map((header, i) => {
    const kind: ExecutiveColumnKind =
      /(اسم|name|student|طالب)/i.test(header) ? "name"
      : /(سنة|year|score|عدد|count|نسب|%)/i.test(header) ? "num"
      : /(جنس|قسم|موهبة)/i.test(header) ? "compact"
      : "text";
    const w =
      kind === "name" ? 42
      : kind === "num" ? 12
      : kind === "compact" ? 11
      : 16;
    return {
      id: `col_${i}`,
      header,
      printableWidthMm: w,
      priority: kind === "name" ? 10 : kind === "num" ? 5 : 3,
      shrink: "proportional" as const,
      clampChars: kind === "name" ? 64 : 48,
      align: "start" as const,
      kind,
      numeric: kind === "num",
      landscapeMinMm: kind === "name" ? 28 : 8,
    };
  });
  const total = base.reduce((s, c) => s + c.printableWidthMm, 0);
  if (total > printable) {
    const scale = printable / total;
    for (const c of base) c.printableWidthMm = Math.round(c.printableWidthMm * scale * 10) / 10;
  }
  return { id, columns: base };
};

export const mapRowsToSchemaIds = (
  schema: ExecutiveTableSchema,
  headers: string[],
  rows: ExecutiveTableRow[]
): ExecutiveTableRow[] =>
  rows.map((row) => {
    const out: ExecutiveTableRow = {};
    schema.columns.forEach((col, i) => {
      const header = headers[i];
      out[col.id] = header != null ? row[header] : row[col.id];
    });
    return out;
  });
