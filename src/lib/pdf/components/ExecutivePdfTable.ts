import { escapeHtml } from "@/lib/pdf/executive-pdf-escape";
import {
  assertFocusedParticipantsLayoutReady,
  buildFocusedParticipantsTableLayout,
  type FocusedParticipantsTableLayoutPlan,
} from "@/lib/analytics/export/focused-participants-pdf-layout-engine";

export type ExecutivePdfTableRow = Record<string, string | number | null | undefined>;

export type ExecutivePdfMiniTableInput = {
  isAr: boolean;
  title?: string;
  headers: [string, string];
  rows: Array<{ label: string; value: string | number }>;
  className?: string;
};

const cellValue = (raw: string | number | null | undefined): string => {
  if (raw == null || raw === "") return "—";
  return escapeHtml(String(raw));
};

const buildParticipantBody = (
  headers: string[],
  rows: ExecutivePdfTableRow[],
  plan: FocusedParticipantsTableLayoutPlan
): string =>
  rows
    .map((row, ri) => {
      const zebra = ri % 2 === 1 ? " ep-row-alt" : "";
      const cells = plan.columns
        .map((col) => {
          const raw = row[col.header];
          const cls =
            col.role === "studentName"
              ? "ep-cell ep-cell-name"
              : col.role === "year" ||
                  col.role === "score" ||
                  col.role === "approval"
                ? "ep-cell ep-cell-num"
                : "ep-cell";
          return `<td class="${cls}">${cellValue(raw)}</td>`;
        })
        .join("");
      return `<tr class="ep-row${zebra}">${cells}</tr>`;
    })
    .join("");

/** Fixed-layout participant register table with computed colgroup (mm). */
export const buildExecutiveParticipantsTableHtml = (
  opts: { headers: string[]; rows: ExecutivePdfTableRow[]; isAr: boolean }
): { html: string; plan: FocusedParticipantsTableLayoutPlan } => {
  const plan = buildFocusedParticipantsTableLayout(opts.headers);
  assertFocusedParticipantsLayoutReady(plan);

  const thead = `<thead><tr>${plan.columns
    .map((c) => `<th scope="col" class="${c.cssClass}">${escapeHtml(c.header)}</th>`)
    .join("")}</tr></thead>`;

  const html = `<table class="ep-grid" style="width:${plan.tableWidthMm}mm;font-size:${plan.bodyFontPx}px" dir="${opts.isAr ? "rtl" : "ltr"}">
${plan.colgroupHtml}
${thead}
<tbody>${buildParticipantBody(opts.headers, opts.rows, plan)}</tbody>
</table>`;

  return { html, plan };
};

/** Compact two-column summary table (charts / KPI slices). */
export const buildExecutiveMiniTableHtml = (input: ExecutivePdfMiniTableInput): string => {
  const cls = input.className ?? "ep-mini";
  const body = input.rows
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.label)}</td><td class="ep-num">${escapeHtml(String(r.value))}</td></tr>`
    )
    .join("");
  const title = input.title ? `<h3>${escapeHtml(input.title)}</h3>` : "";
  return `${title}<table class="${cls}"><thead><tr><th>${escapeHtml(input.headers[0])}</th><th>${escapeHtml(input.headers[1])}</th></tr></thead><tbody>${body}</tbody></table>`;
};

/** Embed-only table rules (multi-section documents). */
export const executiveParticipantsTableEmbedStyles = (): string => `
.ep-table-wrap { width: 100%; overflow: visible; margin-top: 4px; }
`;
