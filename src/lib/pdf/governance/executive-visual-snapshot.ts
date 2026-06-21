/**
 * Deterministic HTML normalization for visual regression snapshots.
 * Strips volatile values (dates, ids) so diffs reflect layout/structure only.
 */

export const normalizeExecutivePdfHtmlForSnapshot = (html: string): string =>
  html
    .replace(/generatedAt[^<]*/gi, "generatedAt:__SNAPSHOT__")
    .replace(/(<strong>تاريخ التصدير:<\/strong>)[^<]*/gi, "$1 __DATE__")
    .replace(/(<strong>Export date:<\/strong>)[^<]*/gi, "$1 __DATE__")
    .replace(/(<span class="ep-footer-meta">[^<]*·\s*)[^<]*/gi, "$1__DATE__")
    .replace(/\d{1,2}\/\d{1,2}\/\d{4}[^<]*/g, "__DATE__")
    .replace(
      /[\u0660-\u0669]{1,2}[\u200f\u200e]?\/[\u0660-\u0669]{1,2}[\u200f\u200e]?\/[\u0660-\u0669]{4}[^<]*/g,
      "__DATE__"
    )
    .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z?/g, "__ISO__")
    .replace(/correlationId["':\s]+[^"'\s>]+/gi, 'correlationId:"__CID__"')
    .replace(/\s+/g, " ")
    .trim();

export const executivePdfStructureFingerprint = (html: string): string => {
  const markers = [
    "ep-official-header",
    "report-header.png",
    "ep-footer",
    "ep-grid",
    "ep-kpi-grid",
    "page-shell",
    "ep-landscape-stage",
    "@page",
    "ep-table-wrap",
  ];
  return markers.map((m) => (html.includes(m) ? m : "-")).join("|");
};
