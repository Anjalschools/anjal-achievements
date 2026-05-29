/** Print-safe accessibility styles — semantic structure, contrast, grayscale. */
export const executivePdfAccessibilityStyles = (): string => `
.ep-sr-caption {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
h1, h2, h3, .ep-h1, .ep-h2 {
  break-after: avoid;
  page-break-after: avoid;
}
table.ep-grid caption.ep-sr-caption + thead {
  display: table-header-group;
}
@media print {
  body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .ep-grid th {
    color: #f8fafc !important;
    background: #172554 !important;
  }
  .ep-grid td, .ep-grid th {
    border-color: #374151 !important;
  }
}
@media print and (monochrome) {
  .ep-grid th {
    background: #374151 !important;
    color: #fff !important;
  }
  .ep-kpi, .exec-panel {
    border-color: #6b7280 !important;
    background: #f9fafb !important;
  }
}
`;

export const semanticSection = (level: 2 | 3, title: string, bodyHtml: string): string => {
  const tag = level === 2 ? "h2" : "h3";
  const cls = level === 2 ? "ep-h2" : "";
  return `<section class="page-section" aria-labelledby="${tag}-${title.slice(0, 12).replace(/\s/g, "-")}">
<${tag} class="${cls}" id="${tag}-${title.slice(0, 12).replace(/\s/g, "-")}">${title}</${tag}>
${bodyHtml}
</section>`;
};
