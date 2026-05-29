/** Executive PDF color tokens — single source, no hardcoded hex in exporters. */
export const EXECUTIVE_COLORS = {
  primaryNavy: "#172554",
  executiveBlue: "#1E3A8A",
  lightBg: "#F8FAFC",
  border: "#CBD5E1",
  headerBg: "#E2E8F0",
  headerText: "#0f172a",
  tableHeadBg: "#172554",
  tableHeadText: "#f8fafc",
  rowAlt: "#F8FAFC",
  goldAccent: "#D4A017",
  text: "#0f172a",
  muted: "#64748b",
  subdued: "#94a3b8",
  risk: "#be123c",
  noteBg: "#fffbeb",
  noteBorder: "#fde68a",
  noteText: "#92400e",
  /** Grayscale-safe print contrast pairs */
  printText: "#111827",
  printMuted: "#4b5563",
  printBorder: "#9ca3af",
} as const;

/** @deprecated use EXECUTIVE_COLORS */
export const EXECUTIVE_PDF_PALETTE = EXECUTIVE_COLORS;
