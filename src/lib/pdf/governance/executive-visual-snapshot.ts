/**
 * Deterministic HTML normalization for visual regression snapshots.
 * Strips volatile values (dates, ids) so diffs reflect layout/structure only.
 */

export const normalizeExecutivePdfHtmlForSnapshot = (html: string): string =>
  html
    .replace(/generatedAt[^<]*/gi, "generatedAt:__SNAPSHOT__")
    .replace(/\d{1,2}\/\d{1,2}\/\d{4}[^<]*/g, "__DATE__")
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
