import { escapeHtml } from "@/lib/pdf/executive-pdf-escape";

export type ExecutiveKpiItem = { label: string; value: string };

export const buildExecutiveKpiGridHtml = (items: ExecutiveKpiItem[], columns = 4): string => {
  if (items.length === 0) return "";
  const cards = items
    .map(
      (k) =>
        `<div class="ep-kpi"><div class="ep-kpi-label">${escapeHtml(k.label)}</div><div class="ep-kpi-value ep-num">${escapeHtml(k.value)}</div></div>`
    )
    .join("");
  return `<div class="ep-kpi-grid" style="grid-template-columns:repeat(${columns}, minmax(0, 1fr))">${cards}</div>`;
};

export const buildExecutiveSummaryPanelHtml = (
  isAr: boolean,
  lines: string[],
  title?: string
): string => {
  if (lines.length === 0) return "";
  const heading = escapeHtml(title ?? (isAr ? "ملخص تنفيذي" : "Executive summary"));
  const list = lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("");
  return `<section class="exec-panel page-section"><h2 class="ep-h2">${heading}</h2><ul class="ep-summary-list">${list}</ul></section>`;
};

export const executiveKpiPanelStyles = (): string => `
.exec-panel {
  border: 1px solid var(--ep-border, #CBD5E1);
  background: #F8FAFC;
  border-radius: 10px;
  padding: 12px 14px;
  margin-bottom: 14px;
  page-break-inside: avoid;
}
.ep-summary-list {
  margin: 8px 20px 0 0;
  padding: 0;
  font-size: 12px;
  line-height: 1.5;
  color: #334155;
}
`;
